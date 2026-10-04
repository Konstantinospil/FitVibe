import * as service from "../../../../apps/backend/src/modules/auth/auth.2fa-login.service.js";
import * as pending from "../../../../apps/backend/src/modules/auth/pending-2fa.repository.js";

jest.mock("../../../../apps/backend/src/modules/auth/pending-2fa.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.audit.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.mapping.js");
jest.mock("../../../../apps/backend/src/modules/consent/consent.repository.js");

const mockPending = jest.mocked(pending);

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
});
