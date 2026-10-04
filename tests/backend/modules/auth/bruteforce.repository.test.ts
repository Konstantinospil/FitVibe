/**
 * Unit tests for brute force protection repository functions
 *
 * Tests both account-level (email+IP) and IP-based brute force protection
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import crypto from "node:crypto";
import db from "../../../../apps/backend/src/db/index.js";
import {
  getFailedAttempt,
  recordFailedAttempt,
  resetFailedAttempts,
  isAccountLocked,
  getRemainingLockoutSeconds,
  getFailedAttemptByIP,
  recordFailedAttemptByIP,
  resetFailedAttemptsByIP,
  isIPLocked,
  getRemainingIPLockoutSeconds,
  cleanupOldAttempts,
  cleanupOldIPAttempts,
} from "../../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import { truncateAll } from "../../../setup/test-helpers";
import { describeWithTestDatabase } from "../../../setup/db-availability.js";

describeWithTestDatabase("Brute Force Protection Repository", () => {
  beforeAll(async () => {
    const tableCheck = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('failed_login_attempts', 'failed_login_attempts_by_ip')
      `);
    const existingTables = tableCheck.rows.map((row: { table_name: string }) => row.table_name);
    const needsMigration =
      !existingTables.includes("failed_login_attempts") ||
      !existingTables.includes("failed_login_attempts_by_ip");

    if (needsMigration) {
      const migrationResults = await db.migrate.latest();

      const postMigrationCheck = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('failed_login_attempts', 'failed_login_attempts_by_ip')
      `);
      const postMigrationTables = postMigrationCheck.rows.map(
        (row: { table_name: string }) => row.table_name,
      );

      if (!postMigrationTables.includes("failed_login_attempts")) {
        throw new Error(
          `Table 'failed_login_attempts' was not created by migrations. ` +
            `Migration results: ${JSON.stringify(migrationResults)}. ` +
            `Existing tables: ${postMigrationTables.join(", ") || "none"}`,
        );
      }
      if (!postMigrationTables.includes("failed_login_attempts_by_ip")) {
        throw new Error(
          `Table 'failed_login_attempts_by_ip' was not created by migrations. ` +
            `Migration results: ${JSON.stringify(migrationResults)}. ` +
            `Existing tables: ${postMigrationTables.join(", ") || "none"}`,
        );
      }
    }
  }, 60000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterEach(async () => {
    await truncateAll();
  });

  describe("Account-Level Protection (email + IP)", () => {
    const identifier = "test@example.com";
    const ipAddress = "192.168.1.1";
    const userAgent = "Mozilla/5.0";

    it("should return null when no failed attempts exist", async () => {
      const result = await getFailedAttempt(identifier, ipAddress);
      expect(result).toBeNull();
    });

    it("should create new failed attempt record", async () => {
      const attempt = await recordFailedAttempt(identifier, ipAddress, userAgent);

      expect(attempt).toBeDefined();
      expect(attempt.identifier).toBe(identifier.toLowerCase());
      expect(attempt.ip_address).toBe(ipAddress);
      expect(attempt.user_agent).toBe(userAgent);
      expect(attempt.attempt_count).toBe(1);
      expect(attempt.locked_until).toBeNull(); // No lockout for first attempt
    });

    it("should increment attempt count on subsequent failures", async () => {
      await recordFailedAttempt(identifier, ipAddress, userAgent);
      const attempt2 = await recordFailedAttempt(identifier, ipAddress, userAgent);
      const attempt3 = await recordFailedAttempt(identifier, ipAddress, userAgent);

      expect(attempt2.attempt_count).toBe(2);
      expect(attempt3.attempt_count).toBe(3);
    });

    it("should decay stale account failure history", async () => {
      await recordFailedAttempt(identifier, ipAddress, userAgent);
      await recordFailedAttempt(identifier, ipAddress, userAgent);

      await db("failed_login_attempts")
        .where({ identifier, ip_address: ipAddress })
        .update({
          last_attempt_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        });

      const attempt = await recordFailedAttempt(identifier, ipAddress, userAgent);

      expect(attempt.attempt_count).toBe(1);
      expect(attempt.locked_until).toBeNull();
    });

    it("should apply progressive lockout after 5 attempts", async () => {
      // Record 4 attempts (no lockout)
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(identifier, ipAddress, userAgent);
      }
      const attempt4 = await getFailedAttempt(identifier, ipAddress);
      expect(attempt4?.locked_until).toBeNull();

      // 5th attempt should trigger 15-minute lockout
      await recordFailedAttempt(identifier, ipAddress, userAgent);
      const attempt5 = await getFailedAttempt(identifier, ipAddress);
      expect(attempt5?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt5!.locked_until!);
      const now = new Date();
      const diffMinutes = (lockoutTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(14);
      expect(diffMinutes).toBeLessThanOrEqual(16); // Allow 1 minute variance
    });

    it("should apply 1-hour lockout after 10 attempts", async () => {
      for (let i = 0; i < 10; i++) {
        await recordFailedAttempt(identifier, ipAddress, userAgent);
      }
      const attempt = await getFailedAttempt(identifier, ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(0.9);
      expect(diffHours).toBeLessThanOrEqual(1.1);
    });

    it("should apply 24-hour lockout after 20 attempts", async () => {
      for (let i = 0; i < 20; i++) {
        await recordFailedAttempt(identifier, ipAddress, userAgent);
      }
      const attempt = await getFailedAttempt(identifier, ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });

    it("should check if account is locked", () => {
      const futureLockout = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const pastLockout = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      expect(
        isAccountLocked({
          id: "1",
          identifier,
          ip_address: ipAddress,
          user_agent: userAgent,
          attempt_count: 5,
          locked_until: futureLockout,
          last_attempt_at: new Date().toISOString(),
          first_attempt_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ).toBe(true);

      expect(
        isAccountLocked({
          id: "1",
          identifier,
          ip_address: ipAddress,
          user_agent: userAgent,
          attempt_count: 5,
          locked_until: pastLockout,
          last_attempt_at: new Date().toISOString(),
          first_attempt_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ).toBe(false);

      expect(isAccountLocked(null)).toBe(false);
    });

    it("should calculate remaining lockout seconds", () => {
      const futureLockout = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const remaining = getRemainingLockoutSeconds({
        id: "1",
        identifier,
        ip_address: ipAddress,
        user_agent: userAgent,
        attempt_count: 5,
        locked_until: futureLockout,
        last_attempt_at: new Date().toISOString(),
        first_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(remaining).toBeGreaterThan(14 * 60);
      expect(remaining).toBeLessThanOrEqual(15 * 60);
    });

    it("should reset failed attempts", async () => {
      await recordFailedAttempt(identifier, ipAddress, userAgent);
      await recordFailedAttempt(identifier, ipAddress, userAgent);

      await resetFailedAttempts(identifier, ipAddress);

      const result = await getFailedAttempt(identifier, ipAddress);
      expect(result).toBeNull();
    });

    it("should handle different email/IP combinations separately", async () => {
      const email1 = "user1@example.com";
      const email2 = "user2@example.com";
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";

      await recordFailedAttempt(email1, ip1, userAgent);
      await recordFailedAttempt(email1, ip2, userAgent);
      await recordFailedAttempt(email2, ip1, userAgent);

      const attempt1 = await getFailedAttempt(email1, ip1);
      const attempt2 = await getFailedAttempt(email1, ip2);
      const attempt3 = await getFailedAttempt(email2, ip1);

      expect(attempt1?.attempt_count).toBe(1);
      expect(attempt2?.attempt_count).toBe(1);
      expect(attempt3?.attempt_count).toBe(1);
    });
  });

  describe("IP-Based Protection", () => {
    const ipAddress = "192.168.1.100";
    const userAgent = "Mozilla/5.0";

    it("should return null when no IP-based attempts exist", async () => {
      const result = await getFailedAttemptByIP(ipAddress);
      expect(result).toBeNull();
    });

    it("should create new IP-based attempt record", async () => {
      const attempt = await recordFailedAttemptByIP(ipAddress, "test1@example.com");

      expect(attempt).toBeDefined();
      expect(attempt.ip_address).toBe(ipAddress);
      expect(attempt.distinct_email_count).toBe(1);
      expect(attempt.total_attempt_count).toBe(1);
      expect(attempt.locked_until).toBeNull(); // No lockout for first attempt
    });

    it("should increment total attempt count", async () => {
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      const attempt2 = await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      const attempt3 = await recordFailedAttemptByIP(ipAddress, "test1@example.com");

      expect(attempt2.total_attempt_count).toBe(2);
      expect(attempt3.total_attempt_count).toBe(3);
      expect(attempt2.distinct_email_count).toBe(1); // Same email
      expect(attempt3.distinct_email_count).toBe(1);
    });

    it("should track distinct email addresses", async () => {
      // Create account-level attempts first (required for distinct count)
      await recordFailedAttempt("test1@example.com", ipAddress, userAgent);
      await recordFailedAttempt("test2@example.com", ipAddress, userAgent);
      await recordFailedAttempt("test3@example.com", ipAddress, userAgent);
      // Then record IP-level attempts
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      await recordFailedAttemptByIP(ipAddress, "test2@example.com");
      await recordFailedAttemptByIP(ipAddress, "test3@example.com");

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.distinct_email_count).toBe(3);
      expect(attempt?.total_attempt_count).toBe(3);
    });

    it("should not increment distinct count for same email", async () => {
      // Create account-level attempts first (required for distinct count)
      await recordFailedAttempt("test1@example.com", ipAddress, userAgent);
      await recordFailedAttempt("test2@example.com", ipAddress, userAgent);
      // Then record IP-level attempts
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      await recordFailedAttemptByIP(ipAddress, "test2@example.com");
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.distinct_email_count).toBe(2); // test1 and test2
      expect(attempt?.total_attempt_count).toBe(4);
    });

    it("should apply 30-minute lockout after 10 attempts or 5 distinct emails", async () => {
      // Test with 10 attempts (same email)
      for (let i = 0; i < 9; i++) {
        await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      }
      const attempt9 = await getFailedAttemptByIP(ipAddress);
      expect(attempt9?.locked_until).toBeNull();

      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      const attempt10 = await getFailedAttemptByIP(ipAddress);
      expect(attempt10?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt10!.locked_until!);
      const now = new Date();
      const diffMinutes = (lockoutTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(29);
      expect(diffMinutes).toBeLessThanOrEqual(31);
    });

    it("should apply 30-minute lockout after 5 distinct emails", async () => {
      // Test with 5 distinct emails (less than 10 total attempts)
      // Create account-level attempts first (required for distinct count)
      for (let i = 1; i <= 5; i++) {
        await recordFailedAttempt(`test${i}@example.com`, ipAddress, userAgent);
        await recordFailedAttemptByIP(ipAddress, `test${i}@example.com`);
      }

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.locked_until).not.toBeNull();
      expect(attempt?.distinct_email_count).toBe(5);
      expect(attempt?.total_attempt_count).toBe(5);

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffMinutes = (lockoutTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(29);
      expect(diffMinutes).toBeLessThanOrEqual(31);
    });

    it("should apply 2-hour lockout after 20 attempts or 10 distinct emails", async () => {
      // Test with 20 attempts
      for (let i = 0; i < 20; i++) {
        await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      }

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(1.9);
      expect(diffHours).toBeLessThanOrEqual(2.1);
    });

    it("should apply 2-hour lockout after 10 distinct emails", async () => {
      // Create account-level attempts first (required for distinct count)
      for (let i = 1; i <= 10; i++) {
        await recordFailedAttempt(`test${i}@example.com`, ipAddress, userAgent);
        await recordFailedAttemptByIP(ipAddress, `test${i}@example.com`);
      }

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(1.9);
      expect(diffHours).toBeLessThanOrEqual(2.1);
    });

    it("should apply 24-hour lockout after 50 attempts or 20 distinct emails", async () => {
      // Test with 50 attempts
      for (let i = 0; i < 50; i++) {
        await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      }

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });

    it("should apply 24-hour lockout after 20 distinct emails", async () => {
      // Create account-level attempts first (required for distinct count)
      for (let i = 1; i <= 20; i++) {
        await recordFailedAttempt(`test${i}@example.com`, ipAddress, userAgent);
        await recordFailedAttemptByIP(ipAddress, `test${i}@example.com`);
      }

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });

    it("should check if IP is locked", () => {
      const futureLockout = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const pastLockout = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      expect(
        isIPLocked({
          id: "1",
          ip_address: ipAddress,
          distinct_email_count: 5,
          total_attempt_count: 10,
          locked_until: futureLockout,
          last_attempt_at: new Date().toISOString(),
          first_attempt_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ).toBe(true);

      expect(
        isIPLocked({
          id: "1",
          ip_address: ipAddress,
          distinct_email_count: 5,
          total_attempt_count: 10,
          locked_until: pastLockout,
          last_attempt_at: new Date().toISOString(),
          first_attempt_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ).toBe(false);

      expect(isIPLocked(null)).toBe(false);
    });

    it("should calculate remaining IP lockout seconds", () => {
      const futureLockout = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const remaining = getRemainingIPLockoutSeconds({
        id: "1",
        ip_address: ipAddress,
        distinct_email_count: 5,
        total_attempt_count: 10,
        locked_until: futureLockout,
        last_attempt_at: new Date().toISOString(),
        first_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(remaining).toBeGreaterThan(29 * 60);
      expect(remaining).toBeLessThanOrEqual(30 * 60);
    });

    it("should reset IP-based failed attempts", async () => {
      await recordFailedAttemptByIP(ipAddress, "test1@example.com");
      await recordFailedAttemptByIP(ipAddress, "test2@example.com");

      await resetFailedAttemptsByIP(ipAddress);

      const result = await getFailedAttemptByIP(ipAddress);
      expect(result).toBeNull();
    });

    it("should handle different IP addresses separately", async () => {
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";

      // Create account-level attempts first (required for distinct count)
      await recordFailedAttempt("test1@example.com", ip1, userAgent);
      await recordFailedAttempt("test2@example.com", ip1, userAgent);
      await recordFailedAttempt("test1@example.com", ip2, userAgent);
      // Then record IP-level attempts
      await recordFailedAttemptByIP(ip1, "test1@example.com");
      await recordFailedAttemptByIP(ip1, "test2@example.com");
      await recordFailedAttemptByIP(ip2, "test1@example.com");

      const attempt1 = await getFailedAttemptByIP(ip1);
      const attempt2 = await getFailedAttemptByIP(ip2);

      expect(attempt1?.total_attempt_count).toBe(2);
      expect(attempt1?.distinct_email_count).toBe(2);
      expect(attempt2?.total_attempt_count).toBe(1);
      expect(attempt2?.distinct_email_count).toBe(1);
    });

    it("should normalize email addresses (lowercase, trim)", async () => {
      await recordFailedAttemptByIP(ipAddress, "  TEST@EXAMPLE.COM  ");
      await recordFailedAttemptByIP(ipAddress, "test@example.com");
      await recordFailedAttemptByIP(ipAddress, "  Test@Example.Com  ");

      const attempt = await getFailedAttemptByIP(ipAddress);
      // All should be treated as same email after normalization
      expect(attempt?.distinct_email_count).toBe(1);
      expect(attempt?.total_attempt_count).toBe(3);
    });
  });

  describe("Cleanup Functions", () => {
    it("should cleanup old account-level attempts", async () => {
      const oldIdentifier = "old@example.com";
      const recentIdentifier = "recent@example.com";
      const ipAddress = "192.168.1.1";
      const userAgent = "Mozilla/5.0";

      // Create old attempt (31 days ago) with different identifier
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      await db("failed_login_attempts").insert({
        id: crypto.randomUUID(),
        identifier: oldIdentifier,
        ip_address: ipAddress,
        user_agent: userAgent,
        attempt_count: 1,
        locked_until: null,
        last_attempt_at: oldDate.toISOString(),
        first_attempt_at: oldDate.toISOString(),
        created_at: oldDate.toISOString(),
        updated_at: oldDate.toISOString(),
      });

      // Create recent attempt with different identifier (so it doesn't update the old one)
      await recordFailedAttempt(recentIdentifier, ipAddress, userAgent);

      const deleted = await cleanupOldAttempts();
      expect(deleted).toBe(1);

      // Old attempt should be deleted
      const oldRemaining = await getFailedAttempt(oldIdentifier, ipAddress);
      expect(oldRemaining).toBeNull();

      // Recent attempt should remain
      const recentRemaining = await getFailedAttempt(recentIdentifier, ipAddress);
      expect(recentRemaining).not.toBeNull();
    });

    it("should cleanup old IP-based attempts", async () => {
      const oldIPAddress = "192.168.1.1";
      const recentIPAddress = "192.168.1.2";

      // Create old attempt (31 days ago) with different IP
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      await db("failed_login_attempts_by_ip").insert({
        id: crypto.randomUUID(),
        ip_address: oldIPAddress,
        distinct_email_count: 1,
        total_attempt_count: 1,
        locked_until: null,
        last_attempt_at: oldDate.toISOString(),
        first_attempt_at: oldDate.toISOString(),
        created_at: oldDate.toISOString(),
        updated_at: oldDate.toISOString(),
      });

      // Create recent attempt with different IP (so it doesn't update the old one)
      await recordFailedAttemptByIP(recentIPAddress, "test@example.com");

      const deleted = await cleanupOldIPAttempts();
      expect(deleted).toBe(1);

      // Old attempt should be deleted
      const oldRemaining = await getFailedAttemptByIP(oldIPAddress);
      expect(oldRemaining).toBeNull();

      // Recent attempt should remain
      const recentRemaining = await getFailedAttemptByIP(recentIPAddress);
      expect(recentRemaining).not.toBeNull();
    });
  });
});
