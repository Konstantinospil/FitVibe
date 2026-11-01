import * as service from "../../../../apps/backend/src/modules/auth/auth.2fa-login.service.js";
import * as pending from "../../../../apps/backend/src/modules/auth/pending-2fa.repository.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import { verify2FACode } from "../../../../apps/backend/src/modules/auth/two-factor.service.js";
import * as sessionTokens from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import * as loginAttempts from "../../../../apps/backend/src/modules/auth/auth.login-attempt.service.js";
import * as legalGate from "../../../../apps/backend/src/modules/auth/auth.legal-gate.js";
import * as authMapping from "../../../../apps/backend/src/modules/auth/auth.mapping.js";

jest.mock("../../../../apps/backend/src/modules/auth/pending-2fa.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.audit.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.mapping.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.login-attempt.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.legal-gate.js");
jest.mock("../../../../apps/backend/src/modules/consent/consent.repository.js");

const mockPending = jest.mocked(pending);
const mockAuthRepository = jest.mocked(authRepository);
const mockVerify2FACode = jest.mocked(verify2FACode);
const mockTokens = jest.mocked(sessionTokens);
const mockLoginAttempts = jest.mocked(loginAttempts);
const mockLegalGate = jest.mocked(legalGate);
const mockMapping = jest.mocked(authMapping);

describe("auth.2fa-login.service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a missing or expired pending-login session before issuing credentials", async () => {
    mockPending.getPending2FASession.mockResolvedValue(null);

    await expect(
      service.verify2FALogin("missing-session", "123456", {
        ip: "203.0.113.5",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "AUTH_VERIFICATION_FAILED",
    });
  });

  it("conceals and rejects an already-used pending-login session", async () => {
    mockPending.getPending2FASession.mockResolvedValue({
      id: "pending-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      ip: "203.0.113.5",
      user_agent: null,
      verified: true,
      created_at: new Date().toISOString(),
    });

    await expect(
      service.verify2FALogin("pending-1", "123456", {
        ip: "203.0.113.5",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "AUTH_VERIFICATION_FAILED",
    });

    expect(mockPending.deletePending2FASession).not.toHaveBeenCalled();
  });
  it("issues an MFA-attested administrator session only after a valid second factor", async () => {
    mockPending.getPending2FASession.mockResolvedValue({
      id: "pending-verified-admin",
      user_id: "admin-1",
      identifier: "admin@example.test",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      ip: "203.0.113.5",
      user_agent: null,
      verified: false,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
    } as never);
    mockVerify2FACode.mockResolvedValue(true);
    mockPending.claimPending2FASessionVerified.mockResolvedValue(true);
    mockAuthRepository.findUserById.mockResolvedValue({
      id: "admin-1",
      status: "active",
      role_code: "admin",
      username: "admin",
      primary_email: "admin@example.test",
    } as never);
    mockLegalGate.assertTermsRequirementSatisfied.mockResolvedValue(undefined);
    mockLoginAttempts.resetLoginFailures.mockResolvedValue(undefined as never);
    mockTokens.nextSessionExpiry.mockReturnValue("2099-01-01T00:00:00.000Z");
    mockTokens.signRefresh.mockReturnValue("mfa-refresh");
    mockTokens.signAccess.mockReturnValue("mfa-access");
    mockTokens.accessTokenTtlForRole.mockReturnValue(300);
    mockMapping.toSafeUser.mockReturnValue({ id: "admin-1" } as never);
    mockAuthRepository.createSessionWithRefresh.mockResolvedValue(undefined as never);

    const result = await service.verify2FALogin("pending-verified-admin", "123456", {
      ip: "203.0.113.5",
    });

    expect(result.tokens).toMatchObject({
      accessToken: "mfa-access",
      refreshToken: "mfa-refresh",
      accessExpiresIn: 300,
    });
    expect(mockTokens.signAccess).toHaveBeenCalledWith(expect.objectContaining({
      sub: "admin-1",
      role: "admin",
      mfa: true,
    }));
    expect(mockTokens.signRefresh).toHaveBeenCalledWith(expect.objectContaining({
      sub: "admin-1",
      mfa: true,
    }));
    expect(mockAuthRepository.createSessionWithRefresh).toHaveBeenCalledTimes(1);
    expect(mockPending.deletePending2FASession).toHaveBeenCalledWith("pending-verified-admin");
  });

  // #557 Stage A: the account can be suspended or removed after its second
  // factor was verified but before the session would be created.
  it.each([
    ["suspended", { id: "user-1", status: "suspended", role_code: "admin" }],
    ["deleted", undefined],
  ])("does not issue a session after a valid code for a %s user", async (_state, user) => {
    mockPending.getPending2FASession.mockResolvedValue({
      id: "pending-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      ip: "203.0.113.5",
      user_agent: null,
      verified: false,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
    } as never);
    mockVerify2FACode.mockResolvedValue(true);
    mockPending.claimPending2FASessionVerified.mockResolvedValue(true);
    mockAuthRepository.findUserById.mockResolvedValue(user as never);

    await expect(
      service.verify2FALogin("pending-1", "123456", { ip: "203.0.113.5" }),
    ).rejects.toMatchObject({ status: 401, code: "AUTH_VERIFICATION_FAILED" });

    expect(mockVerify2FACode).toHaveBeenCalledWith("user-1", "123456");
    expect(mockPending.claimPending2FASessionVerified).toHaveBeenCalledWith("pending-1");
    expect(mockAuthRepository.createSessionWithRefresh).not.toHaveBeenCalled();
  });

});
