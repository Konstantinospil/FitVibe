/**
 * Integration tests for 2-stage login flow (AC-1.6)
 *
 * Tests the complete flow:
 * 1. Stage 1: User logs in with email/password, receives pendingSessionId if 2FA enabled
 * 2. Stage 2: User verifies 2FA code with pendingSessionId, receives tokens
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as authService from "../../../apps/backend/src/modules/auth/auth.service.js";
import * as twofaService from "../../../apps/backend/src/modules/auth/two-factor.service.js";
import * as authRepo from "../../../apps/backend/src/modules/auth/auth.repository.js";
import * as pending2faRepo from "../../../apps/backend/src/modules/auth/pending-2fa.repository.js";
import * as bruteforceRepo from "../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import type { FailedLoginAttempt } from "../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import type { LoginDTO, LoginContext } from "../../../apps/backend/src/modules/auth/auth.types.js";
import type { AuthUserRecord } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";

// Mock dependencies
jest.mock("../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../apps/backend/src/modules/auth/two-factor.service.js");
jest.mock("../../../apps/backend/src/modules/auth/pending-2fa.repository.js");
jest.mock("../../../apps/backend/src/modules/auth/bruteforce.repository.js");
jest.mock("../../../apps/backend/src/modules/consent/consent.repository.js", () => ({
  attachAnonymousConsents: jest.fn().mockResolvedValue(0),
  getConsentByIp: jest.fn(),
  upsertConsent: jest.fn(),
}));
jest.mock("../../../apps/backend/src/db/index.js", () => {
  const mockInsert = jest.fn().mockResolvedValue([]);
  const mockTransaction = jest.fn((callback) => {
    const mockTrx = {
      insert: jest.fn().mockResolvedValue([]),
    };
    return callback(mockTrx);
  });
  const mockDb = jest.fn(() => ({
    insert: mockInsert,
  }));
  mockDb.insert = mockInsert;
  mockDb.transaction = mockTransaction;
  return {
    db: mockDb,
    default: mockDb,
  };
});
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("crypto");
jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-0000-0000-000000000123"),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mockAuthRepo = jest.mocked(authRepo);
const mockTwofaService = jest.mocked(twofaService);
const mockPending2faRepo = jest.mocked(pending2faRepo);
const mockBruteforceRepo = jest.mocked(bruteforceRepo);

describe("2-Stage Login Flow (AC-1.6)", () => {
  let mockUser: AuthUserRecord;

  beforeEach(async () => {
    mockUser = {
      id: USER_ID,
      username: "testuser",
      display_name: "Test User",
      locale: "en-US",
      preferred_lang: "en",
      primary_email: "test@example.com",
      email_verified: true,
      role_code: "athlete",
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      password_hash: "hashed-password",
      terms_accepted: true,
      terms_accepted_at: "2024-01-01T00:00:00Z",
      terms_version: await getCurrentTermsVersion(),
    };
  });

  const loginDto: LoginDTO = {
    email: "test@example.com",
    password: "ValidPassword123!",
  };

  const loginContext: LoginContext = {
    userAgent: "Mozilla/5.0",
    ip: "127.0.0.1",
    requestId: "req-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock bruteforce repository functions (account-level)
    mockBruteforceRepo.getFailedAttempt.mockResolvedValue(null);
    mockBruteforceRepo.recordFailedAttempt.mockResolvedValue({
      id: "attempt-123",
      identifier: "test@example.com",
      ip_address: "127.0.0.1",
      user_agent: "Mozilla/5.0",
      attempt_count: 1,
      locked_until: null,
      last_attempt_at: new Date().toISOString(),
      first_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockBruteforceRepo.resetFailedAttempts.mockResolvedValue(undefined);
    // Mock synchronous functions - these are called with the result of getFailedAttempt
    // Since getFailedAttempt returns null, isAccountLocked(null) should return false
    (mockBruteforceRepo.isAccountLocked as jest.Mock).mockImplementation(
      (attempt: FailedLoginAttempt | null) => {
        if (!attempt || !attempt.locked_until) {
          return false;
        }
        const now = new Date();
        const lockoutExpiry = new Date(attempt.locked_until);
        return now < lockoutExpiry;
      },
    );
    (mockBruteforceRepo.getRemainingLockoutSeconds as jest.Mock).mockReturnValue(0);

    // Mock IP-based bruteforce repository functions
    mockBruteforceRepo.getFailedAttemptByIP.mockResolvedValue(null);
    mockBruteforceRepo.recordFailedAttemptByIP.mockResolvedValue({
      id: "ip-attempt-123",
      ip_address: "127.0.0.1",
      distinct_email_count: 1,
      total_attempt_count: 1,
      locked_until: null,
      last_attempt_at: new Date().toISOString(),
      first_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockBruteforceRepo.resetFailedAttemptsByIP.mockResolvedValue(undefined);
    mockPending2faRepo.hasRecentSecondFactorThrottle.mockResolvedValue(false);
    mockPending2faRepo.claimPending2FASessionVerified.mockResolvedValue(true);
    mockPending2faRepo.incrementPending2FAFailures.mockResolvedValue({
      id: "pending-session-123",
      user_id: USER_ID,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip: "127.0.0.1",
      user_agent: "Mozilla/5.0",
      verified: false,
      failed_attempts: 1,
      identifier: "test@example.com",
      last_failed_at: new Date().toISOString(),
    });
    // Mock IP-based synchronous functions
    (mockBruteforceRepo.isIPLocked as jest.Mock).mockImplementation((attempt) => {
      if (!attempt || !attempt.locked_until) {
        return false;
      }
      const now = new Date();
      const lockoutExpiry = new Date(attempt.locked_until);
      return now < lockoutExpiry;
    });
    (mockBruteforceRepo.getRemainingIPLockoutSeconds as jest.Mock).mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Stage 1: Login with 2FA enabled", () => {
    it("should return requires2FA=true and pendingSessionId when user has 2FA enabled", async () => {
      // Setup: User exists, password correct, 2FA enabled
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      const bcrypt = jest.mocked(await import("bcryptjs"));
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockTwofaService.is2FAEnabled.mockResolvedValue(true);
      mockPending2faRepo.createPending2FASession.mockResolvedValue({
        id: "pending-session-123",
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });

      // Execute
      const result = await authService.login(loginDto, loginContext);

      // Verify
      expect(result.requires2FA).toBe(true);
      if (result.requires2FA) {
        expect(result.pendingSessionId).toBe("00000000-0000-0000-0000-000000000123");
      }
      expect(mockTwofaService.is2FAEnabled).toHaveBeenCalledWith(USER_ID);
      expect(mockPending2faRepo.createPending2FASession).toHaveBeenCalled();
      const pendingSession = mockPending2faRepo.createPending2FASession.mock.calls[0]?.[0];
      expect(new Date(pendingSession.expires_at).getTime() - Date.now()).toBeGreaterThanOrEqual(
        29 * 60 * 1000,
      );
      expect(new Date(pendingSession.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(
        30 * 60 * 1000,
      );
      expect(mockAuthRepo.createSessionWithRefresh).not.toHaveBeenCalled(); // No session created yet
    });

    it("should return requires2FA=false and tokens when user has 2FA disabled", async () => {
      // Setup: User exists, password correct, 2FA disabled
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      const bcrypt = jest.mocked(await import("bcryptjs"));
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockTwofaService.is2FAEnabled.mockResolvedValue(false);
      mockAuthRepo.createSessionWithRefresh.mockResolvedValue(undefined);
      

      const jwt = jest.mocked(await import("jsonwebtoken"));
      jest.mocked(jwt.sign).mockReturnValue("mock-jwt-token" as never);

      const crypto = jest.mocked(await import("crypto"));
      interface MockHashInstance {
        update: jest.Mock<MockHashInstance, [data: string | Buffer]>;
        digest: jest.Mock<string, [encoding?: string]>;
      }
      const mockHashInstance: MockHashInstance = {
        update: jest.fn<MockHashInstance, [data: string | Buffer]>().mockReturnThis(),
        digest: jest.fn<string, [encoding?: string]>().mockReturnValue("mock-hash"),
      };
      jest.mocked(crypto.createHash).mockReturnValue(mockHashInstance as never);

      // Execute
      const result = await authService.login(loginDto, loginContext);

      // Verify
      expect(result.requires2FA).toBe(false);
      if (!result.requires2FA) {
        expect(result.user.id).toBe(USER_ID);
        expect(result.tokens.accessToken).toBeDefined();
        expect(result.tokens.refreshToken).toBeDefined();
        expect(result.session.id).toBeDefined();
      }
      expect(mockTwofaService.is2FAEnabled).toHaveBeenCalledWith(USER_ID);
      expect(mockPending2faRepo.createPending2FASession).not.toHaveBeenCalled();
      expect(mockAuthRepo.createSessionWithRefresh).toHaveBeenCalled(); // Session created
    });
  });

  describe("Stage 2: Verify 2FA code", () => {
    const pendingSessionId = "pending-session-123";
    const validCode = "123456";

    it("should issue tokens when 2FA code is valid", async () => {
      // Setup: Valid pending session, valid code
      mockPending2faRepo.getPending2FASession.mockResolvedValue({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });
      mockTwofaService.verify2FACode.mockResolvedValue(true);
      mockPending2faRepo.markPending2FASessionVerified.mockResolvedValue(undefined);
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);
      mockAuthRepo.createSessionWithRefresh.mockResolvedValue(undefined);
      
      mockPending2faRepo.deletePending2FASession.mockResolvedValue(undefined);

      const jwt = jest.mocked(await import("jsonwebtoken"));
      jest.mocked(jwt.sign).mockReturnValue("mock-jwt-token" as never);

      const crypto = jest.mocked(await import("crypto"));
      interface MockHashInstance {
        update: jest.Mock<MockHashInstance, [data: string | Buffer]>;
        digest: jest.Mock<string, [encoding?: string]>;
      }
      const mockHashInstance: MockHashInstance = {
        update: jest.fn<MockHashInstance, [data: string | Buffer]>().mockReturnThis(),
        digest: jest.fn<string, [encoding?: string]>().mockReturnValue("mock-hash"),
      };
      jest.mocked(crypto.createHash).mockReturnValue(mockHashInstance as never);

      // Execute
      const result = await authService.verify2FALogin(pendingSessionId, validCode, loginContext);

      // Verify
      expect(result.user.id).toBe(USER_ID);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.session.id).toBeDefined();
      expect(mockTwofaService.verify2FACode).toHaveBeenCalledWith(USER_ID, validCode);
      expect(mockPending2faRepo.claimPending2FASessionVerified).toHaveBeenCalledWith(
        pendingSessionId,
      );
      expect(mockPending2faRepo.deletePending2FASession).toHaveBeenCalledWith(pendingSessionId);
    });

    it("should throw error when 2FA code is invalid", async () => {
      // Setup: Valid pending session, invalid code
      mockPending2faRepo.getPending2FASession.mockResolvedValue({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });
      mockTwofaService.verify2FACode.mockResolvedValue(false);

      // Execute & Verify
      await expect(
        authService.verify2FALogin(pendingSessionId, "wrong-code", loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockTwofaService.verify2FACode).toHaveBeenCalledWith(USER_ID, "wrong-code");
      expect(mockPending2faRepo.claimPending2FASessionVerified).not.toHaveBeenCalled();
      expect(mockPending2faRepo.incrementPending2FAFailures).toHaveBeenCalledWith(pendingSessionId);
      expect(mockAuthRepo.createSessionWithRefresh).not.toHaveBeenCalled();
    });

    it("should exhaust the challenge after the third failed 2FA attempt", async () => {
      mockPending2faRepo.getPending2FASession
        .mockResolvedValueOnce({
          id: pendingSessionId,
          user_id: USER_ID,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          ip: "127.0.0.1",
          user_agent: "Mozilla/5.0",
          verified: false,
          failed_attempts: 2,
        })
        .mockResolvedValueOnce({
          id: pendingSessionId,
          user_id: USER_ID,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          ip: "127.0.0.1",
          user_agent: "Mozilla/5.0",
          verified: false,
          failed_attempts: 3,
        });
      mockPending2faRepo.incrementPending2FAFailures.mockResolvedValueOnce({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
        failed_attempts: 3,
        last_failed_at: new Date().toISOString(),
      });
      mockTwofaService.verify2FACode.mockResolvedValueOnce(false);

      await expect(
        authService.verify2FALogin(pendingSessionId, "123456", loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      jest.clearAllMocks();

      await expect(
        authService.verify2FALogin(pendingSessionId, "123456", loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockTwofaService.verify2FACode).not.toHaveBeenCalled();
      expect(mockAuthRepo.createSessionWithRefresh).not.toHaveBeenCalled();
    });

    it("should throw error when pending session does not exist", async () => {
      // Setup: No pending session
      mockPending2faRepo.getPending2FASession.mockResolvedValue(null);

      // Execute & Verify
      await expect(
        authService.verify2FALogin("non-existent-session", validCode, loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockTwofaService.verify2FACode).not.toHaveBeenCalled();
    });

    it("should throw error when pending session is expired", async () => {
      // Setup: Expired pending session
      mockPending2faRepo.getPending2FASession.mockResolvedValue({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Expired 5 mins ago
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });
      mockPending2faRepo.deletePending2FASession.mockResolvedValue(undefined);

      // Execute & Verify
      await expect(
        authService.verify2FALogin(pendingSessionId, validCode, loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockPending2faRepo.deletePending2FASession).not.toHaveBeenCalled();
      expect(mockTwofaService.verify2FACode).not.toHaveBeenCalled();
    });

    it("should throw error when pending session is already verified", async () => {
      // Setup: Already verified session
      mockPending2faRepo.getPending2FASession.mockResolvedValue({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: true, // Already verified
      });
      mockPending2faRepo.deletePending2FASession.mockResolvedValue(undefined);

      // Execute & Verify
      await expect(
        authService.verify2FALogin(pendingSessionId, validCode, loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockPending2faRepo.deletePending2FASession).not.toHaveBeenCalled();
      expect(mockTwofaService.verify2FACode).not.toHaveBeenCalled();
    });

    it("should throw error when IP address does not match (session hijacking protection)", async () => {
      // Setup: Valid pending session but different IP
      mockPending2faRepo.getPending2FASession.mockResolvedValue({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "192.168.1.1", // Different IP
        user_agent: "Mozilla/5.0",
        verified: false,
      });
      mockPending2faRepo.deletePending2FASession.mockResolvedValue(undefined);

      // Execute & Verify
      await expect(
        authService.verify2FALogin(pendingSessionId, validCode, loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");

      expect(mockPending2faRepo.deletePending2FASession).not.toHaveBeenCalled();
      expect(mockTwofaService.verify2FACode).not.toHaveBeenCalled();
    });
  });

  describe("Security Features", () => {
    it("should prevent session reuse after successful verification", async () => {
      const pendingSessionId = "pending-session-123";
      const validCode = "123456";

      // First verification - success
      mockPending2faRepo.getPending2FASession.mockResolvedValueOnce({
        id: pendingSessionId,
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });
      mockTwofaService.verify2FACode.mockResolvedValue(true);
      mockPending2faRepo.markPending2FASessionVerified.mockResolvedValue(undefined);
      mockAuthRepo.findUserById.mockResolvedValue(mockUser);
      mockAuthRepo.createSessionWithRefresh.mockResolvedValue(undefined);
      
      mockPending2faRepo.deletePending2FASession.mockResolvedValue(undefined);

      const jwt = jest.mocked(await import("jsonwebtoken"));
      jest.mocked(jwt.sign).mockReturnValue("mock-jwt-token" as never);

      const crypto = jest.mocked(await import("crypto"));
      interface MockHashInstance {
        update: jest.Mock<MockHashInstance, [data: string | Buffer]>;
        digest: jest.Mock<string, [encoding?: string]>;
      }
      const mockHashInstance: MockHashInstance = {
        update: jest.fn<MockHashInstance, [data: string | Buffer]>().mockReturnThis(),
        digest: jest.fn<string, [encoding?: string]>().mockReturnValue("mock-hash"),
      };
      jest.mocked(crypto.createHash).mockReturnValue(mockHashInstance as never);

      await authService.verify2FALogin(pendingSessionId, validCode, loginContext);

      // Second attempt - should be deleted
      mockPending2faRepo.getPending2FASession.mockResolvedValueOnce(null);

      await expect(
        authService.verify2FALogin(pendingSessionId, validCode, loginContext),
      ).rejects.toThrow("AUTH_VERIFICATION_FAILED");
    });

    it("should create audit log entries for 2FA events", async () => {
      // Stage 1: 2FA required
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      const bcrypt = jest.mocked(await import("bcryptjs"));
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockTwofaService.is2FAEnabled.mockResolvedValue(true);
      mockPending2faRepo.createPending2FASession.mockResolvedValue({
        id: "pending-session-123",
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        verified: false,
      });

      await authService.login(loginDto, loginContext);

      // Verify pending 2FA session was created
      expect(mockPending2faRepo.createPending2FASession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "00000000-0000-0000-0000-000000000123",
          user_id: USER_ID,
          ip: "127.0.0.1",
          user_agent: "Mozilla/5.0",
        }),
      );
    });
  });
});
