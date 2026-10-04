import bcrypt from "bcryptjs";
import { login } from "../../../../apps/backend/src/modules/auth/auth.service.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.users.repository.js";
import * as bruteforceRepository from "../../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.users.repository.js";

jest.mock("../../../../apps/backend/src/db/index.js", () => {
  const builder = {
    insert: jest.fn().mockResolvedValue([]),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  };
  const mockDb = Object.assign(
    jest.fn(() => builder),
    {
      transaction: jest.fn(async (cb: (trx: unknown) => Promise<unknown>) => {
        const trx = Object.assign(
          jest.fn(() => builder),
          builder,
          { raw: jest.fn().mockResolvedValue(undefined) },
        );
        return cb(trx);
      }),
    },
  );
  return { db: mockDb, default: mockDb };
});

describe("Q-11 login enumeration protections", () => {
  const findUserByEmailSpy = jest.spyOn(authRepository, "findUserByEmail");
  const compareSpy = jest.spyOn(bcrypt, "compare") as unknown as jest.SpyInstance<
    Promise<boolean>,
    [string | Buffer, string]
  >;
  const getFailedAttemptSpy = jest.spyOn(bruteforceRepository, "getFailedAttempt");
  const recordFailedAttemptSpy = jest.spyOn(bruteforceRepository, "recordFailedAttempt");
  const getFailedAttemptByIPSpy = jest.spyOn(bruteforceRepository, "getFailedAttemptByIP");
  const recordFailedAttemptByIPSpy = jest.spyOn(bruteforceRepository, "recordFailedAttemptByIP");

  beforeEach(() => {
    jest.clearAllMocks();
    compareSpy.mockResolvedValue(false);
    // Mock bruteforce repository functions
    getFailedAttemptSpy.mockResolvedValue(null);
    recordFailedAttemptSpy.mockResolvedValue({
      id: "attempt-123",
      identifier: "test@example.com",
      ip_address: "127.0.0.1",
      user_agent: null,
      attempt_count: 1,
      locked_until: null,
      last_attempt_at: new Date().toISOString(),
      first_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    getFailedAttemptByIPSpy.mockResolvedValue(null);
    recordFailedAttemptByIPSpy.mockResolvedValue({
      id: "ip-attempt-123",
      ip_address: "127.0.0.1",
      total_attempt_count: 1,
      distinct_email_count: 1,
      locked_until: null,
      last_attempt_at: new Date().toISOString(),
      first_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it("performs a dummy password comparison when the user does not exist", async () => {
    findUserByEmailSpy.mockResolvedValue(undefined);

    const result = await login({ email: "missing@fitvibe.test", password: "Secret123" });

    expect(result.requires2FA).toBe(true);
    expect(result.pendingSessionId).toEqual(expect.any(String));

    expect(compareSpy).toHaveBeenCalledWith("Secret123", expect.any(String));
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });

  it("performs a dummy comparison when the account is not active", async () => {
    const inactiveUser: AuthUserRecord = {
      id: "user-inactive",
      username: "inactive",
      display_name: "Inactive",
      locale: "en-US",
      preferred_lang: "en",
      status: "pending_verification",
      role_code: "athlete",
      password_hash: "$2a$10$123456789012345678901uWXyzabcdefghijklmnopqrstuv",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      primary_email: "inactive@fitvibe.test",
      email_verified: false,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: "2024-06-01",
    };
    findUserByEmailSpy.mockResolvedValue(inactiveUser);

    const result = await login({ email: "inactive@fitvibe.test", password: "Secret123" });

    expect(result.requires2FA).toBe(true);
    expect(result.pendingSessionId).toEqual(expect.any(String));

    expect(compareSpy).toHaveBeenCalledWith("Secret123", expect.any(String));
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });
});
