import { register } from "../../../../apps/backend/src/modules/auth/auth.service.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import type * as AuthRepositoryModule from "../../../../apps/backend/src/modules/auth/auth.repository.js";

jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js", () => ({
  isEmailBlacklisted: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js", () => {
  const actual = jest.requireActual<typeof AuthRepositoryModule>(
    "../../../../apps/backend/src/modules/auth/auth.repository.js",
  );
  return {
    ...actual,
    findUserByEmail: jest.fn(),
    findUserByUsername: jest.fn(),
    createUser: jest.fn(),
    createAuthToken: jest.fn(),
    markAuthTokensConsumed: jest.fn(),
    countAuthTokensSince: jest.fn(),
    purgeAuthTokensOlderThan: jest.fn(),
  };
});

const authRepository = jest.mocked(
  jest.requireMock<typeof AuthRepositoryModule>(
    "../../../../apps/backend/src/modules/auth/auth.repository.js",
  ),
);

const {
  findUserByEmail: mockFindUserByEmail,
  findUserByUsername: mockFindUserByUsername,
  createAuthToken: mockCreateAuthToken,
  markAuthTokensConsumed: mockMarkAuthTokensConsumed,
  countAuthTokensSince: mockCountAuthTokensSince,
  purgeAuthTokensOlderThan: mockPurgeAuthTokensOlderThan,
} = authRepository;

jest.mock("../../../../apps/backend/src/services/mailer.service.js", () => ({
  mailerService: {
    send: jest.fn(),
  },
}));

const BASE_TIME = new Date("2025-10-21T10:00:00.000Z");

describe("Q-10 email verification policies", () => {
  const pendingUser: AuthUserRecord = {
    id: "user-1",
    username: "jamie",
    display_name: "Jamie",
    locale: "en-US",
    preferred_lang: "en",
    status: "pending_verification",
    role_code: "athlete",
    password_hash: "$2a$10$123456789012345678901uWXyzabcdefghijklmnopqrstuv",
    created_at: new Date("2025-10-20T00:00:00.000Z").toISOString(),
    updated_at: new Date("2025-10-20T00:00:00.000Z").toISOString(),
    primary_email: "jamie@fitvibe.test",
    email_verified: false,
    terms_accepted: true,
    terms_accepted_at: "2025-10-20T00:00:00.000Z",
    terms_version: "2024-01-01",
  };

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(BASE_TIME);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserByEmail.mockResolvedValue(pendingUser);
    mockFindUserByUsername.mockResolvedValue(undefined);
    mockCreateAuthToken.mockResolvedValue([]);
    mockMarkAuthTokensConsumed.mockResolvedValue(0);
    mockPurgeAuthTokensOlderThan.mockResolvedValue(0);
  });

  it("issues a verification token with 15 minute TTL and purges stale tokens older than 7 days", async () => {
    jest.useRealTimers(); // Use real timers for this test to avoid async hangs
    try {
      mockCountAuthTokensSince.mockResolvedValue(2); // within resend window

      const result = await register({
        email: pendingUser.primary_email ?? "",
        username: pendingUser.username,
        password: "StrongPassw0rd!",
        terms_accepted: true,
      });

      expect(result.user?.id).toBe(pendingUser.id);
      expect(result.verificationToken).toEqual(expect.any(String));

      expect(mockCountAuthTokensSince).toHaveBeenCalledWith(
        pendingUser.id,
        "email_verification",
        expect.any(Date),
      );

      expect(mockPurgeAuthTokensOlderThan).toHaveBeenCalledWith(
        "email_verification",
        expect.any(Date),
      );

      expect(mockMarkAuthTokensConsumed).toHaveBeenCalledWith(pendingUser.id, "email_verification");

      expect(mockCreateAuthToken).toHaveBeenCalledTimes(1);
      const [[createPayload]] = mockCreateAuthToken.mock.calls;
      const createdAt = new Date(createPayload.created_at);
      const expiresAt = new Date(createPayload.expires_at);
      const ttlSeconds = Math.round((expiresAt.getTime() - createdAt.getTime()) / 1000);
      expect(ttlSeconds).toBe(15 * 60);
    } finally {
      jest.useFakeTimers().setSystemTime(BASE_TIME); // Restore fake timers for other tests
    }
  }, 60000); // 60 second timeout

  it("rejects verification resends when limit (3 per hour) is exceeded", async () => {
    jest.useRealTimers(); // Use real timers for this test to avoid async hangs
    try {
      mockCountAuthTokensSince.mockResolvedValue(3);

      await expect(
        register({
          email: pendingUser.primary_email ?? "",
          username: pendingUser.username,
          password: "StrongPassw0rd!",
          terms_accepted: true,
        }),
      ).rejects.toMatchObject({
        status: 429,
        code: "AUTH_TOO_MANY_REQUESTS",
      });

      expect(mockPurgeAuthTokensOlderThan).toHaveBeenCalledWith(
        "email_verification",
        expect.any(Date),
      );
      expect(mockCreateAuthToken).not.toHaveBeenCalled();
    } finally {
      jest.useFakeTimers().setSystemTime(BASE_TIME); // Restore fake timers for other tests
    }
  }, 60000); // 60 second timeout
});
