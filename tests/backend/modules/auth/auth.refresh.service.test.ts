import jwt from "jsonwebtoken";
import * as service from "../../../../apps/backend/src/modules/auth/auth.refresh.service.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import * as metrics from "../../../../apps/backend/src/observability/metrics.js";
import * as audit from "../../../../apps/backend/src/modules/auth/auth.audit.js";
import * as legalGate from "../../../../apps/backend/src/modules/auth/auth.legal-gate.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import { checkAndTouchPrivilegedSession } from "../../../../apps/backend/src/modules/auth/auth.state.repository.js";
import { is2FAEnabled } from "../../../../apps/backend/src/modules/auth/two-factor.service.js";

jest.mock("jsonwebtoken");
jest.mock("../../../../apps/backend/src/modules/auth/auth.state.repository.js", () => ({
  checkAndTouchPrivilegedSession: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js", () => ({
  is2FAEnabled: jest.fn(),
}));
// The repository barrel re-exports several modules. Automatic mocking of the
// barrel can omit atomic helpers (notably rotateRefreshAtomic and
// revokeSessionFamilyAtomic), leaving tests unable to reach their assertions.
// Explicitly mock every repository operation used by this service.
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js", () => ({
  findRefreshTokenRaw: jest.fn(),
  findSessionById: jest.fn(),
  findUserById: jest.fn(),
  getRefreshByHash: jest.fn(),
  revokeRefreshByHash: jest.fn(),
  revokeSessionFamilyAtomic: jest.fn(),
  rotateRefreshAtomic: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/observability/metrics.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.audit.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.legal-gate.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js", () => ({
  nextSessionExpiry: jest.fn(() => "2026-10-01T00:00:00.000Z"),
  signAccess: jest.fn(() => "new-access"),
  signRefresh: jest.fn(() => "new-refresh"),
}));

const mockJwt = jest.mocked(jwt);
const mockPrivilegedSessionCheck = jest.mocked(checkAndTouchPrivilegedSession);
const mockIs2FAEnabled = jest.mocked(is2FAEnabled);
const mockRepository = jest.mocked(authRepository);
const mockMetrics = jest.mocked(metrics);
const mockAudit = jest.mocked(audit);
const mockLegalGate = jest.mocked(legalGate);

function mockValidState(): void {
  mockRepository.getRefreshByHash.mockResolvedValue({
    id: "refresh-1",
    user_id: "user-1",
    token_hash: "hash",
    session_jti: "session-1",
    expires_at: "2099-10-01T00:00:00.000Z",
    created_at: "2026-09-21T00:00:00.000Z",
    revoked_at: null,
  });
  mockRepository.findSessionById.mockResolvedValue({
    jti: "session-1",
    user_id: "user-1",
    user_agent: null,
    ip: null,
    created_at: "2026-09-21T00:00:00.000Z",
    expires_at: "2099-10-01T00:00:00.000Z",
    revoked_at: null,
    last_active_at: null,
  });
  mockRepository.findUserById.mockResolvedValue({
    id: "user-1",
    status: "active",
    role_code: "athlete",
  } as never);
}

describe("auth.refresh.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIs2FAEnabled.mockResolvedValue(false);
    mockPrivilegedSessionCheck.mockResolvedValue(true);
    mockLegalGate.assertTermsRequirementSatisfied.mockResolvedValue(undefined);
    mockAudit.sanitizeAuthUserAgent.mockImplementation((value) => value ?? null);
    mockJwt.verify.mockReturnValue({
      sub: "user-1",
      sid: "session-1",
      typ: "refresh",
    } as never);
  });

  it("does not rotate refresh state when persisted terms require re-acceptance", async () => {
    mockValidState();
    mockLegalGate.assertTermsRequirementSatisfied.mockRejectedValue(
      new HttpError(403, "TERMS_VERSION_OUTDATED", "TERMS_VERSION_OUTDATED"),
    );

    await expect(service.refresh("refresh-token")).rejects.toMatchObject({
      code: "TERMS_VERSION_OUTDATED",
    });
    expect(mockRepository.rotateRefreshAtomic).not.toHaveBeenCalled();
  });

  it("rotates the refresh token and session metadata in one atomic repository call", async () => {
    mockValidState();
    mockRepository.rotateRefreshAtomic.mockResolvedValue(true);

    await expect(
      service.refresh("refresh-token", { ip: "203.0.113.10", userAgent: "agent" }),
    ).resolves.toMatchObject({
      newRefresh: "new-refresh",
      accessToken: "new-access",
    });

    expect(mockRepository.rotateRefreshAtomic).toHaveBeenCalledWith(
      expect.any(String),
      "session-1",
      expect.objectContaining({
        user_id: "user-1",
        session_jti: "session-1",
      }),
      expect.objectContaining({
        expires_at: "2026-10-01T00:00:00.000Z",
        ip: "203.0.113.10",
        user_agent: "agent",
      }),
    );
    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      "user-1",
      "auth.refresh",
      expect.objectContaining({ sessionId: "session-1" }),
    );
  });

  // Test ownership: #557 administrator role promotion, MFA attestation and refresh.
  it.each(["admin", "superadmin"])(
    "revokes password-only %s refresh without rotating or minting access",
    async (role) => {
      mockValidState();
      mockRepository.findUserById.mockResolvedValue({
        id: "user-1",
        status: "active",
        role_code: role,
      } as never);
      await expect(service.refresh("refresh-token")).rejects.toMatchObject({
        status: 403,
        code: "ADMIN_2FA_REQUIRED",
      });
      expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
      expect(mockRepository.rotateRefreshAtomic).not.toHaveBeenCalled();
      expect(mockIs2FAEnabled).not.toHaveBeenCalled();
    },
  );

  it("blocks pre-promotion athlete refresh after persisted promotion to admin", async () => {
    mockValidState();
    mockRepository.findUserById.mockResolvedValue({
      id: "user-1",
      status: "active",
      role_code: "admin",
    } as never);
    mockJwt.verify.mockReturnValue({
      sub: "user-1",
      sid: "session-1",
      typ: "refresh",
      role: "athlete",
      mfa: false,
    } as never);
    await expect(service.refresh("pre-promotion-token")).rejects.toMatchObject({
      code: "ADMIN_2FA_REQUIRED",
    });
    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
  });

  it("rejects an MFA-attested admin refresh when TOTP was disabled", async () => {
    mockValidState();
    mockRepository.findUserById.mockResolvedValue({
      id: "user-1",
      status: "active",
      role_code: "admin",
    } as never);
    mockJwt.verify.mockReturnValue({
      sub: "user-1",
      sid: "session-1",
      typ: "refresh",
      mfa: true,
    } as never);
    mockIs2FAEnabled.mockResolvedValue(false);
    await expect(service.refresh("stale-mfa-token")).rejects.toMatchObject({
      code: "ADMIN_2FA_REQUIRED",
    });
    expect(mockIs2FAEnabled).toHaveBeenCalledWith("user-1");
    expect(mockRepository.rotateRefreshAtomic).not.toHaveBeenCalled();
    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
  });

  it("rotates a verified admin refresh while preserving MFA attestation", async () => {
    mockValidState();
    mockRepository.findUserById.mockResolvedValue({
      id: "user-1",
      status: "active",
      role_code: "admin",
    } as never);
    mockJwt.verify.mockReturnValue({
      sub: "user-1",
      sid: "session-1",
      typ: "refresh",
      mfa: true,
    } as never);
    mockIs2FAEnabled.mockResolvedValue(true);
    mockRepository.rotateRefreshAtomic.mockResolvedValue(true);
    await expect(service.refresh("verified-token")).resolves.toMatchObject({
      accessToken: "new-access",
      newRefresh: "new-refresh",
    });
    expect(mockIs2FAEnabled).toHaveBeenCalledWith("user-1");
    expect(mockRepository.rotateRefreshAtomic).toHaveBeenCalledTimes(1);
    expect(mockRepository.revokeSessionFamilyAtomic).not.toHaveBeenCalled();
  });

  it("rejects expired privileged inactivity without rotating a refresh token", async () => {
    mockValidState();
    mockRepository.findUserById.mockResolvedValue({
      id: "user-1", status: "active", role_code: "admin",
    } as never);
    mockJwt.verify.mockReturnValue({
      sub: "user-1", sid: "session-1", typ: "refresh", mfa: true,
    } as never);
    mockIs2FAEnabled.mockResolvedValue(true);
    mockPrivilegedSessionCheck.mockResolvedValue(false);

    await expect(service.refresh("idle-admin-token")).rejects.toMatchObject({
      status: 401, code: "AUTH_SESSION_EXPIRED",
    });
    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
    expect(mockRepository.rotateRefreshAtomic).not.toHaveBeenCalled();
  });

  it("keeps athlete refresh available without requiring TOTP", async () => {
    mockValidState();
    mockRepository.rotateRefreshAtomic.mockResolvedValue(true);
    await expect(service.refresh("athlete-token")).resolves.toMatchObject({
      accessToken: "new-access",
    });
    expect(mockIs2FAEnabled).not.toHaveBeenCalled();
  });

  it("revokes the session family when a concurrent rotation loses the row lock race", async () => {
    mockValidState();
    mockRepository.rotateRefreshAtomic.mockResolvedValue(false);

    await expect(service.refresh("refresh-token")).rejects.toMatchObject({
      status: 401,
      code: "AUTH_INVALID_REFRESH",
    });

    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
    expect(mockMetrics.incrementRefreshReuse).toHaveBeenCalledTimes(1);
    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      "user-1",
      "auth.refresh_reuse",
      expect.objectContaining({
        sessionId: "session-1",
        familyRevoked: true,
        concurrentReplay: true,
      }),
    );
  });

  it("revokes the token family and records reuse when a consumed refresh token is replayed", async () => {
    mockRepository.getRefreshByHash.mockResolvedValue(undefined);
    mockRepository.findRefreshTokenRaw.mockResolvedValue({
      id: "refresh-old",
      user_id: "user-1",
      token_hash: "hash",
      session_jti: "session-1",
      expires_at: "2026-10-01T00:00:00.000Z",
      created_at: "2026-09-21T00:00:00.000Z",
      revoked_at: "2026-09-21T01:00:00.000Z",
    });

    await expect(
      service.refresh("reused-refresh", {
        requestId: "req-1",
        ip: "203.0.113.5",
        userAgent: "test-agent",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "AUTH_INVALID_REFRESH",
    });

    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
    expect(mockMetrics.incrementRefreshReuse).toHaveBeenCalledTimes(1);
    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      "user-1",
      "auth.refresh_reuse",
      expect.objectContaining({
        sessionId: "session-1",
        familyRevoked: true,
        outcome: "failure",
      }),
    );
  });

  it("revokes the whole session family on logout", async () => {
    await service.logout("refresh-token", { requestId: "req-logout" });

    expect(mockRepository.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-1");
    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      "user-1",
      "auth.logout",
      expect.objectContaining({
        sessionId: "session-1",
        familyRevoked: true,
        accessInvalidated: true,
      }),
    );
  });
});
