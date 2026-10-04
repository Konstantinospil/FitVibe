import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import * as authService from "../../../../apps/backend/src/modules/auth/auth.service.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import * as twofaService from "../../../../apps/backend/src/modules/auth/two-factor.service.js";
import * as bruteforceRepo from "../../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import * as pending2faRepo from "../../../../apps/backend/src/modules/auth/pending-2fa.repository.js";
import * as emailBlacklistRepository from "../../../../apps/backend/src/modules/common/email-blacklist.repository.js";
import * as mailerService from "../../../../apps/backend/src/services/mailer.service.js";
import {
  acceptCurrentLegalDocument,
  acceptLegalDocumentVersion,
  getCurrentLegalPublication,
  getLegalActionStatus,
} from "../../../../apps/backend/src/modules/legal/legal.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  RegisterDTO,
  LoginDTO,
  UserSafe,
  TokenPair,
} from "../../../../apps/backend/src/modules/auth/auth.types.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.repository.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js", () => ({
  isEmailBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/bruteforce.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/pending-2fa.repository.js");
jest.mock("../../../../apps/backend/src/modules/legal/legal.service.js", () => ({
  getCurrentLegalPublication: jest.fn(),
  acceptLegalDocumentVersion: jest.fn(),
  acceptCurrentLegalDocument: jest.fn(),
  getLegalActionStatus: jest.fn(),
  getCurrentLegalVersions: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/services/mailer.service.js", () => ({
  mailerService: {
    send: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("../../../../apps/backend/src/config/env.js", () => {
  const mockEnvInternal = {
    email: { enabled: false },
    frontendUrl: "http://localhost:3000",
    ACCESS_TOKEN_TTL: 3600,
    REFRESH_TOKEN_TTL: 604800,
    EMAIL_VERIFICATION_TTL_SEC: 3600,
    PASSWORD_RESET_TTL_SEC: 3600,
    database: {
      host: "localhost",
      port: 5432,
      name: "fitvibe",
      user: "fitvibe",
      password: "fitvibe",
    },
  };
  return {
    env: mockEnvInternal,
    RSA_KEYS: { publicKey: "test-key", privateKey: "test-key" },
    __mockEnv: mockEnvInternal, // Export for test access
  };
});
jest.mock("../../../../apps/backend/src/modules/auth/timing.utils.js", () => ({
  normalizeAuthTiming: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/config/terms.js", () => ({
  getCurrentTermsVersion: jest.fn(() => "1.0.0"),
  isTermsVersionOutdated: jest.fn(() => false),
}));
jest.mock("../../../../apps/backend/src/services/i18n.service.js", () => ({
  getEmailTranslations: jest.fn(() => ({
    verification: { subject: "Verify your email" },
    resend: { subject: "Resend verification" },
    passwordReset: { subject: "Reset password" },
  })),
  generateVerificationEmailHtml: jest.fn(() => "<html>verify</html>"),
  generateVerificationEmailText: jest.fn(() => "verify"),
  generateResendVerificationEmailHtml: jest.fn(() => "<html>resend</html>"),
  generateResendVerificationEmailText: jest.fn(() => "resend"),
}));
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const mockAuthRepo = jest.mocked(authRepository);
const mockTwofaService = jest.mocked(twofaService);
const mockBruteforceRepo = jest.mocked(bruteforceRepo);
const mockPending2faRepo = jest.mocked(pending2faRepo);
const mockEmailBlacklist = jest.mocked(emailBlacklistRepository);
const mockMailerService = jest.mocked(mailerService);
const mockGetCurrentLegalPublication = jest.mocked(getCurrentLegalPublication);
const mockGetLegalActionStatus = jest.mocked(getLegalActionStatus);
const mockAcceptLegalDocumentVersion = jest.mocked(acceptLegalDocumentVersion);
const mockAcceptCurrentLegalDocument = jest.mocked(acceptCurrentLegalDocument);
const mockBcrypt = jest.mocked(bcrypt);
const mockJwt = jest.mocked(jwt);

// Get access to the mocked env
const envModule = jest.requireMock("../../../../apps/backend/src/config/env.js");
const mockEnv = envModule.__mockEnv || envModule.env;

// Mock knexfile.js first to prevent db/index.js from trying to load dotenv
jest.mock("../../../../apps/backend/src/db/knexfile.js", () => ({
  default: {},
}));

// Mock db - following the same pattern as admin.repository.test.ts
const queryBuilders: Record<string, unknown> = {};

function createMockQueryBuilder(defaultValue: unknown = 1) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockResolvedValue([]),
  });
  return builder;
}

jest.mock("../../../../apps/backend/src/db/index.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  }) as jest.Mock & {
    where: jest.Mock;
    update: jest.Mock;
    transaction: jest.Mock;
  };

  mockDbFunction.transaction = jest.fn((callback) => {
    const mockTrx = ((table: string) => {
      if (!queryBuilders[table]) {
        queryBuilders[table] = createMockQueryBuilder();
      }
      return queryBuilders[table];
    }) as any;
    return Promise.resolve(callback(mockTrx));
  });

  return {
    default: mockDbFunction,
    db: mockDbFunction,
  };
});

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const builders: Record<string, unknown> = {};

  const createBuilder = () => {
    const builder = Object.assign(Promise.resolve([]), {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      onConflict: jest.fn().mockReturnThis(),
      ignore: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue(undefined),
    });
    return builder;
  };

  const db = jest.fn((table: string) => {
    if (!builders[table]) {
      builders[table] = createBuilder();
    }
    return builders[table];
  }) as jest.Mock & {
    transaction: jest.Mock;
  };

  db.transaction = jest.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
    callback(db),
  );

  return { db };
});

describe("Auth Service", () => {
  const userId = "user-123";
  const email = "test@example.com";
  const username = "testuser";
  const password = "SecureP@ssw0rd123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailBlacklist.isEmailBlacklisted.mockResolvedValue(false);
    mockGetLegalActionStatus.mockResolvedValue({
      currentVersion: "1.0.0",
      requiredVersion: "1.0.0",
      acceptedVersion: "1.0.0",
      acceptedAt: "2024-06-01T00:00:00.000Z",
      requiredAction: "accept",
      needsAction: false,
    });
    mockGetCurrentLegalPublication.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      document_type: "terms",
      version: "1.0.0",
      change_class: "legacy",
      user_action: "accept",
      effective_at: "2024-06-01T00:00:00.000Z",
      published_at: "2024-06-01T00:00:00.000Z",
      published_by: null,
      source: "legacy_migration",
      created_at: "2024-06-01T00:00:00.000Z",
    });
    mockAcceptLegalDocumentVersion.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      document_type: "terms",
      version: "1.0.0",
      change_class: "legacy",
      user_action: "accept",
      effective_at: "2024-06-01T00:00:00.000Z",
      published_at: "2024-06-01T00:00:00.000Z",
      published_by: null,
      source: "legacy_migration",
      created_at: "2024-06-01T00:00:00.000Z",
    });
    mockAcceptCurrentLegalDocument.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      document_type: "terms",
      version: "1.0.0",
      change_class: "legacy",
      user_action: "accept",
      effective_at: "2024-06-01T00:00:00.000Z",
      published_at: "2024-06-01T00:00:00.000Z",
      published_by: null,
      source: "legacy_migration",
      created_at: "2024-06-01T00:00:00.000Z",
    });
    process.env.EMAIL_ENABLED = "false";
    process.env.ACCESS_TOKEN_TTL = "3600";
    process.env.REFRESH_TOKEN_TTL = "604800";
    process.env.EMAIL_VERIFICATION_TTL_SEC = "3600";
    process.env.PASSWORD_RESET_TTL_SEC = "3600";
    // Mock helper functions from bruteforce.repository
    (mockBruteforceRepo.getRemainingAccountAttempts as jest.Mock) = jest.fn((attempt) => {
      if (!attempt) {
        return 5;
      }
      return Math.max(0, 5 - attempt.attempt_count);
    });
    (mockBruteforceRepo.getRemainingIPAttempts as jest.Mock) = jest.fn((attempt) => {
      if (!attempt) {
        return 5;
      }
      return Math.max(0, 5 - attempt.attempt_count);
    });
  });

  describe("register", () => {
    const validRegisterDto: RegisterDTO = {
      email,
      username,
      password,
      terms_accepted: true,
    };

    it("rejects an authoritative blacklisted email before account creation", async () => {
      mockEmailBlacklist.isEmailBlacklisted.mockResolvedValue(true);

      await expect(authService.register(validRegisterDto)).rejects.toMatchObject({
        code: "AUTH_EMAIL_BLOCKED",
        status: 403,
      });
      expect(mockAuthRepo.createUser).not.toHaveBeenCalled();
    });

    it("should register a new user successfully", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        primary_email: email,
        username,
        password_hash: "hashed_password",
        email_verified: false,
        status: "pending_verification",
        role_code: "athlete",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue("hashed_password" as never);
      mockAuthRepo.createUser.mockResolvedValue(mockUser);
      mockAuthRepo.createAuthToken.mockResolvedValue("verification-token");
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);

      const result = await authService.register(validRegisterDto);

      expect(result.user.email).toBe(email);
      expect(result.user.username).toBe(username);
      expect(mockAuthRepo.createUser).toHaveBeenCalled();
    });

    it("should pass registration profile data to the atomic user create", async () => {
      const profileDto: RegisterDTO = {
        ...validRegisterDto,
        profile: {
          display_name: "Test Athlete",
          sex: "prefer_not_to_say",
          weight_kg: 82.5,
          fitness_level: "advanced",
          date_of_birth: "1994-05-12",
        },
      };
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue("hashed_password" as never);
      mockAuthRepo.createUser.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue("verification-token");
      mockAuthRepo.findUserById.mockResolvedValue(undefined);

      await authService.register(profileDto);

      expect(mockAuthRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: "Test Athlete",
          gender_code: "prefer_not_to_say",
          weight_kg: 82.5,
          fitness_level_code: "advanced",
          date_of_birth: "1994-05-12",
        }),
        expect.anything(),
      );
    });

    it("should throw error when email already exists", async () => {
      const existingUser: AuthUserRecord = {
        id: userId,
        email,
        username: "otheruser",
        password_hash: "hash",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(validRegisterDto)).rejects.toThrow(HttpError);
      await expect(authService.register(validRegisterDto)).rejects.toThrow("AUTH_CONFLICT");
    });

    it("should throw error when username already exists", async () => {
      const existingUser: AuthUserRecord = {
        id: userId,
        email: "other@example.com",
        username,
        password_hash: "hash",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.findUserByUsername.mockResolvedValue(existingUser);

      await expect(authService.register(validRegisterDto)).rejects.toThrow(HttpError);
      await expect(authService.register(validRegisterDto)).rejects.toThrow("AUTH_CONFLICT");
    });

    it("should resend verification for pending user", async () => {
      const pendingUser: AuthUserRecord = {
        id: userId,
        email,
        primary_email: email,
        username,
        password_hash: "hash",
        email_verified: false,
        status: "pending_verification",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        locale: "en",
      };

      // Temporarily enable email for this test
      const originalEnabled = mockEnv.email.enabled;
      mockEnv.email.enabled = true;

      mockAuthRepo.findUserByEmail.mockResolvedValue(pendingUser);
      mockAuthRepo.createAuthToken.mockResolvedValue("verification-token");

      await expect(authService.register(validRegisterDto)).resolves.toBeDefined();
      expect(mockMailerService.mailerService.send).toHaveBeenCalled();

      mockEnv.email.enabled = originalEnabled;
    });

    it("should throw error when terms not accepted", async () => {
      const dtoWithoutTerms: RegisterDTO = {
        ...validRegisterDto,
        terms_accepted: false,
      };

      // Ensure no existing user to trigger the terms check
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);

      await expect(authService.register(dtoWithoutTerms)).rejects.toThrow(HttpError);
      await expect(authService.register(dtoWithoutTerms)).rejects.toThrow(
        "TERMS_ACCEPTANCE_REQUIRED",
      );
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      const token = "verification-token";
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        primary_email: email,
        username,
        password_hash: "hash",
        email_verified: false,
        status: "pending_verification",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findAuthToken.mockResolvedValue({
        id: "token-id",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash",
        consumed: false,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
      });
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);
      mockAuthRepo.consumeAuthToken.mockResolvedValue(undefined);
      mockAuthRepo.updateUserStatus.mockResolvedValue(undefined);

      await authService.verifyEmail(token);

      expect(mockEmailBlacklist.isEmailBlacklisted).toHaveBeenCalledWith(email);
      expect(mockAuthRepo.consumeAuthToken).toHaveBeenCalled();
      expect(mockAuthRepo.updateUserStatus).toHaveBeenCalledWith(userId, "active");
    });

    it("should throw error when token not found", async () => {
      mockAuthRepo.findAuthToken.mockResolvedValue(null);

      await expect(authService.verifyEmail("invalid-token")).rejects.toThrow(HttpError);
    });

    it("should throw error when token expired", async () => {
      mockAuthRepo.findAuthToken.mockResolvedValue({
        id: "token-id",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash",
        consumed: false,
        expires_at: new Date(Date.now() - 1000).toISOString(),
        created_at: new Date().toISOString(),
      });

      await expect(authService.verifyEmail("expired-token")).rejects.toThrow(HttpError);
    });
  });

  describe("login", () => {
    const validLoginDto: LoginDTO = {
      email,
      password,
    };

    it("should login successfully without 2FA", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        username,
        password_hash: "hashed_password",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockTwofaService.is2FAEnabled.mockResolvedValue(false);
      mockAuthRepo.createSessionWithRefresh.mockResolvedValue(undefined);
      
      mockBruteforceRepo.getFailedAttempt.mockResolvedValue(null);
      mockBruteforceRepo.getFailedAttemptByIP.mockResolvedValue(null);
      mockBruteforceRepo.resetFailedAttempts.mockResolvedValue(undefined);
      mockBruteforceRepo.resetFailedAttemptsByIP.mockResolvedValue(undefined);
      mockJwt.sign
        .mockReturnValueOnce("refresh_token" as never)
        .mockReturnValueOnce("access_token" as never);

      const result = await authService.login(validLoginDto);

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it("should conceal a missing user behind an opaque pre-auth challenge", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockBruteforceRepo.recordFailedAttempt.mockResolvedValue({
        attempt_count: 1,
        locked_until: null,
      } as never);
      mockBruteforceRepo.recordFailedAttemptByIP.mockResolvedValue({
        total_attempt_count: 1,
        distinct_email_count: 1,
        locked_until: null,
      } as never);
      mockJwt.sign
        .mockReturnValueOnce("dummy-refresh-token" as never)
        .mockReturnValueOnce("dummy-access-token" as never);

      const result = await authService.login(validLoginDto);

      expect(result.requires2FA).toBe(true);
      expect(result.pendingSessionId).toBeDefined();
      expect(mockAuthRepo.createSessionWithRefresh).not.toHaveBeenCalled();
    });

    it("should throw error when password incorrect", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        username,
        password_hash: "hashed_password",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockAttempt = {
        id: "attempt-id",
        identifier: email,
        attempt_count: 1,
        locked_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const mockIPAttempt = {
        id: "ip-attempt-id",
        ip_address: "127.0.0.1",
        total_attempt_count: 1,
        distinct_email_count: 1,
        locked_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);
      mockBruteforceRepo.recordFailedAttempt.mockResolvedValue(mockAttempt);
      mockBruteforceRepo.recordFailedAttemptByIP.mockResolvedValue(mockIPAttempt);
      mockBruteforceRepo.getFailedAttempt.mockResolvedValue(mockAttempt);
      mockBruteforceRepo.getFailedAttemptByIP.mockResolvedValue(mockIPAttempt);
      mockJwt.sign
        .mockReturnValueOnce("dummy-refresh-token" as never)
        .mockReturnValueOnce("dummy-access-token" as never);

      const result = await authService.login(validLoginDto);

      expect(result.requires2FA).toBe(true);
      expect(result.pendingSessionId).toBeDefined();
      expect(mockAuthRepo.createSessionWithRefresh).not.toHaveBeenCalled();
    });

    it("should require 2FA when enabled", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        username,
        password_hash: "hashed_password",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockTwofaService.is2FAEnabled.mockResolvedValue(true);
      mockBruteforceRepo.getFailedAttempt.mockResolvedValue(null);
      mockBruteforceRepo.getFailedAttemptByIP.mockResolvedValue(null);
      mockBruteforceRepo.resetFailedAttempts.mockResolvedValue(undefined);
      mockBruteforceRepo.resetFailedAttemptsByIP.mockResolvedValue(undefined);
      mockPending2faRepo.hasRecentSecondFactorThrottle.mockResolvedValue(false);
      mockPending2faRepo.createPending2FASession.mockResolvedValue(undefined);

      const result = await authService.login(validLoginDto);

      expect(result.requires2FA).toBe(true);
      expect(result.pendingSessionId).toBeDefined();
    });
  });

  describe("refresh", () => {
    it("should refresh tokens successfully", async () => {
      const refreshToken = "refresh_token";
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        username,
        password_hash: "hash",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const sessionId = "session-id";
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      mockJwt.verify.mockImplementation((token: string) => {
        if (token === refreshToken) {
          return {
            sub: userId,
            sid: sessionId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
          };
        }
        throw new Error("Invalid token");
      });
      mockAuthRepo.getRefreshByHash.mockResolvedValue({
        id: "refresh-id",
        user_id: userId,
        token_hash: "hash",
        session_jti: sessionId,
        revoked: false,
        expires_at: futureDate,
        created_at: new Date().toISOString(),
      });
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);
      mockAuthRepo.findSessionById.mockResolvedValue({
        jti: sessionId,
        user_id: userId,
        user_agent: null,
        ip: null,
        created_at: new Date().toISOString(),
        expires_at: futureDate,
        revoked_at: null,
      });
      mockAuthRepo.rotateRefreshAtomic.mockResolvedValue(true);
      mockJwt.sign
        .mockReturnValueOnce("new_refresh_token" as never)
        .mockReturnValueOnce("new_access_token" as never);
      

      const result = await authService.refresh(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.newRefresh).toBeDefined();
    });

    it("should throw error when refresh token invalid", async () => {
      mockAuthRepo.getRefreshByHash.mockResolvedValue(null);

      await expect(authService.refresh("invalid-token")).rejects.toThrow(HttpError);
    });
  });

  describe("requestPasswordReset", () => {
    it("should request password reset for existing user", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        username,
        password_hash: "hash",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        locale: "en",
      };

      // Temporarily enable email for this test
      const originalEnabled = mockEnv.email.enabled;
      mockEnv.email.enabled = true;

      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.createAuthToken.mockResolvedValue("reset-token");

      await authService.requestPasswordReset(email);

      expect(mockAuthRepo.createAuthToken).toHaveBeenCalled();
      expect(mockMailerService.mailerService.send).toHaveBeenCalled();

      mockEnv.email.enabled = originalEnabled;
    });

    it("should return empty result for non-existent user (prevent enumeration)", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);

      await authService.requestPasswordReset("nonexistent@example.com");

      expect(mockAuthRepo.createAuthToken).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      const token = "reset-token";
      const newPassword = "NewP@ssw0rd123";
      const mockUser: AuthUserRecord = {
        id: userId,
        email,
        primary_email: email,
        username,
        password_hash: "old_hash",
        email_verified: true,
        status: "active",
        terms_accepted: true,
        terms_version: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthRepo.findAuthToken.mockResolvedValue({
        id: "token-id",
        user_id: userId,
        token_type: "password_reset",
        token_hash: "hash",
        consumed: false,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
      });
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);
      mockBcrypt.hash.mockResolvedValue("new_hashed_password" as never);
      mockAuthRepo.resetPasswordAtomic.mockResolvedValue(true);

      await authService.resetPassword(token, newPassword);

      expect(mockAuthRepo.resetPasswordAtomic).toHaveBeenCalledWith(
        userId,
        "new_hashed_password",
        "token-id",
        "password_reset",
      );
    });

    it("should throw error when token not found", async () => {
      mockAuthRepo.findAuthToken.mockResolvedValue(null);

      await expect(authService.resetPassword("invalid-token", "password")).rejects.toThrow(
        HttpError,
      );
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      const refreshToken = "refresh_token";

      mockJwt.verify.mockReturnValue({
        sub: userId,
        sid: "session-id",
        typ: "refresh",
      } as never);
      mockAuthRepo.revokeSessionFamilyAtomic.mockResolvedValue(undefined);

      await authService.logout(refreshToken);

      expect(mockAuthRepo.revokeSessionFamilyAtomic).toHaveBeenCalledWith("session-id");
    });
  });

  describe("acceptTerms", () => {
    it("should accept terms successfully", async () => {
      // The mock is already set up to return a query builder that resolves successfully
      // Just verify the service completes without throwing
      await expect(authService.acceptTerms(userId)).resolves.toBeUndefined();
    });
  });
});
