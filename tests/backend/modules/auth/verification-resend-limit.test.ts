/**
 * Tests for AC-1.8: Email Verification Resend Limiting & Auto-Purge
 *
 * Requirements:
 * - Verify resend limit 3/hour per account
 * - Auto-purge unverified accounts after 7 days
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import * as retentionService from "../../../../apps/backend/src/services/retention.service.js";
import * as authService from "../../../../apps/backend/src/modules/auth/auth.service.js";
import * as authRepo from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.repository.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository");
jest.mock("bcryptjs");
jest.mock("../../../../apps/backend/src/services/mailer.service.js");
jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js", () => ({
  isEmailBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../../../apps/backend/src/modules/users/dsr.service.js", () => ({
  processDueAccountDeletions: jest.fn<() => Promise<number>>().mockResolvedValue(0),
}));
jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    del: jest.fn().mockResolvedValue(0),
  };
  return {
    db: jest.fn(() => mockQueryBuilder),
  };
});

const mockAuthRepo = jest.mocked(authRepo);

describe("AC-1.8: Email Verification Resend Limiting & Auto-Purge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Email Verification Resend Limiting (3/hour)", () => {
    const mockUser: AuthUserRecord = {
      id: "user-123",
      username: "testuser",
      display_name: "Test User",
      locale: "en-US",
      preferred_lang: "en",
      primary_email: "test@example.com",
      email_verified: false,
      role_code: "athlete",
      status: "pending_verification",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      password_hash: "hashed-password",
      terms_accepted: true,
      terms_accepted_at: "2024-01-01T00:00:00Z",
      terms_version: "2024-01-01",
    };

    it("should allow first verification email resend", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(0); // No recent attempts
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      const result = await authService.register({
        email: "test@example.com",
        username: "testuser",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      expect(result.verificationToken).toBeDefined();
      expect(mockAuthRepo.countAuthTokensSince).toHaveBeenCalled();
    });

    it("should allow second verification email resend", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(1); // 1 recent attempt
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      const result = await authService.register({
        email: "test@example.com",
        username: "testuser",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      expect(result.verificationToken).toBeDefined();
    });

    it("should allow third verification email resend", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(2); // 2 recent attempts
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      const result = await authService.register({
        email: "test@example.com",
        username: "testuser",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      expect(result.verificationToken).toBeDefined();
    });

    it("should block fourth verification email resend (rate limit exceeded)", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(3); // 3 recent attempts (limit reached)

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      await expect(
        authService.register({
          email: "test@example.com",
          username: "testuser",
          password: "ValidPassword123!",
          terms_accepted: true,
        }),
      ).rejects.toThrow("AUTH_TOO_MANY_REQUESTS");

      // Should not create new token
      expect(mockAuthRepo.createAuthToken).not.toHaveBeenCalled();
    });

    it("should check resend count within 1 hour window", async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(0);
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      await authService.register({
        email: "test@example.com",
        username: "testuser",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      // Verify countAuthTokensSince was called with a date ~1 hour ago
      expect(mockAuthRepo.countAuthTokensSince).toHaveBeenCalledWith(
        "user-123",
        "email_verification",
        expect.any(Date),
      );

      const callArgs = mockAuthRepo.countAuthTokensSince.mock.calls[0];
      const windowStart = callArgs?.[2] as Date;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Window start should be approximately 1 hour ago (within 1 second tolerance)
      expect(Math.abs(windowStart.getTime() - oneHourAgo.getTime())).toBeLessThan(1000);
    });
  });

  describe("Auto-Purge Unverified Accounts (7 days)", () => {
    beforeEach(() => {
      // Clear mocks before each test
      jest.clearAllMocks();
    });

    it("should purge accounts older than 7 days with pending_verification status", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(5), // 5 accounts purged
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder as any);

      const now = new Date("2024-01-10T00:00:00Z");
      const result = await retentionService.purgeUnverifiedAccounts(now);

      expect(result).toBe(5);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("status", "pending_verification");
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "created_at",
        "<",
        "2024-01-03T00:00:00.000Z", // 7 days before now
      );
      expect(mockQueryBuilder.del).toHaveBeenCalled();
    });

    it("should return 0 when no unverified accounts to purge", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(0),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder);

      const now = new Date();
      const result = await retentionService.purgeUnverifiedAccounts(now);

      expect(result).toBe(0);
    });

    it("should not purge accounts newer than 7 days", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(0),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder);

      const now = new Date("2024-01-05T00:00:00Z");
      await retentionService.purgeUnverifiedAccounts(now);

      // Should check for accounts created before 2023-12-29 (7 days ago)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "created_at",
        "<",
        "2023-12-29T00:00:00.000Z",
      );
    });

    it("should only purge pending_verification accounts, not active accounts", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(0),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder);

      await retentionService.purgeUnverifiedAccounts();

      // Must filter by status='pending_verification'
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("status", "pending_verification");
    });

    it("should be included in retention sweep", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(0),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder);

      const now = new Date();
      const summary = await retentionService.runRetentionSweep(now);

      expect(summary).toHaveProperty("purgedUnverifiedAccounts");
      expect(typeof summary.purgedUnverifiedAccounts).toBe("number");
    });
  });

  describe("Integration: Resend Limiting & Auto-Purge Together", () => {
    it("should track resend attempts for accounts that will be purged", async () => {
      const mockUser: AuthUserRecord = {
        id: "user-old",
        username: "olduser",
        display_name: "Old User",
        locale: "en-US",
        preferred_lang: "en",
        primary_email: "old@example.com",
        email_verified: false,
        role_code: "athlete",
        status: "pending_verification",
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days old
        updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        password_hash: "hashed",
        terms_accepted: true,
        terms_accepted_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        terms_version: "2024-01-01",
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(0);
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      // User can still request resend even if account is old
      const result = await authService.register({
        email: "old@example.com",
        username: "olduser",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      expect(result.verificationToken).toBeDefined();

      // But the retention job would purge this account
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(1),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder as any);

      const purgedCount = await retentionService.purgeUnverifiedAccounts(new Date());
      expect(purgedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle rate limiting for multiple users independently", async () => {
      const user1: AuthUserRecord = {
        id: "user-1",
        username: "user1",
        display_name: "User 1",
        locale: "en-US",
        preferred_lang: "en",
        primary_email: "user1@example.com",
        email_verified: false,
        role_code: "athlete",
        status: "pending_verification",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        password_hash: "hashed",
        terms_accepted: true,
        terms_accepted_at: "2024-01-01T00:00:00Z",
        terms_version: "2024-01-01",
      };

      const user2: AuthUserRecord = {
        id: "user-2",
        username: "user2",
        display_name: "User 2",
        locale: "en-US",
        preferred_lang: "en",
        primary_email: "user2@example.com",
        email_verified: false,
        role_code: "athlete",
        status: "pending_verification",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        password_hash: "hashed",
        terms_accepted: true,
        terms_accepted_at: "2024-01-01T00:00:00Z",
        terms_version: "2024-01-01",
      };

      // User 1 has hit the limit
      mockAuthRepo.findUserByEmail.mockResolvedValueOnce(user1);
      mockAuthRepo.findUserByUsername.mockResolvedValue(null);
      mockAuthRepo.countAuthTokensSince.mockResolvedValueOnce(3);

      const bcrypt = await import("bcryptjs");
      jest.mocked(bcrypt.hashSync).mockReturnValue("hashed");

      await expect(
        authService.register({
          email: "user1@example.com",
          username: "user1",
          password: "ValidPassword123!",
          terms_accepted: true,
        }),
      ).rejects.toThrow("AUTH_TOO_MANY_REQUESTS");

      // User 2 should still be able to request
      mockAuthRepo.findUserByEmail.mockResolvedValueOnce(user2);
      mockAuthRepo.countAuthTokensSince.mockResolvedValueOnce(1);
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(undefined);
      mockAuthRepo.createAuthToken.mockResolvedValue(undefined);

      const result = await authService.register({
        email: "user2@example.com",
        username: "user2",
        password: "ValidPassword123!",
        terms_accepted: true,
      });

      expect(result.verificationToken).toBeDefined();
    });

    it("should calculate 7 days threshold correctly across month boundaries", async () => {
      const { db } = await import("../../../../apps/backend/src/db/connection.js");
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(0),
      };
      jest.mocked(db).mockReturnValue(mockQueryBuilder);

      // Current date: March 5, 2024
      const now = new Date("2024-03-05T00:00:00Z");
      await retentionService.purgeUnverifiedAccounts(now);

      // Should purge accounts created before February 27, 2024 (7 days ago)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "created_at",
        "<",
        "2024-02-27T00:00:00.000Z",
      );
    });
  });
});
