import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { issueAuthToken, TOKEN_TYPES } from "../../../../apps/backend/src/modules/auth/auth.tokens.service.js";
import * as authRepo from "../../../../apps/backend/src/modules/auth/auth.repository.js";

jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");

const repo = jest.mocked(authRepo);

describe("Stage A: reset-token issuance policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.purgeAuthTokensOlderThan.mockResolvedValue(undefined as never);
    repo.markAuthTokensConsumed.mockResolvedValue(undefined as never);
    repo.createAuthToken.mockResolvedValue(undefined as never);
  });

  it.each([901, 1440 * 60, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid or excessive reset TTL %s before touching persistence",
    async (ttl) => {
      await expect(issueAuthToken("user-1", TOKEN_TYPES.PASSWORD_RESET, ttl)).rejects.toThrow(
        "Password-reset token TTL exceeds the security policy",
      );
      expect(repo.createAuthToken).not.toHaveBeenCalled();
      expect(repo.markAuthTokensConsumed).not.toHaveBeenCalled();
    },
  );

  it("permits the 15-minute ceiling", async () => {
    await issueAuthToken("user-1", TOKEN_TYPES.PASSWORD_RESET, 900);
    expect(repo.createAuthToken).toHaveBeenCalledTimes(1);
    const record = repo.createAuthToken.mock.calls[0]?.[0];
    expect(record).toBeDefined();
    const issued = new Date(record!.created_at).getTime();
    const expiry = new Date(record!.expires_at).getTime();
    expect(expiry - issued).toBe(900_000);
  });

  it("does not apply the reset-specific ceiling to email-verification tokens", async () => {
    repo.countAuthTokensSince.mockResolvedValue(0 as never);
    await issueAuthToken("user-1", TOKEN_TYPES.EMAIL_VERIFICATION, 1800);
    expect(repo.createAuthToken).toHaveBeenCalledTimes(1);
  });
});
