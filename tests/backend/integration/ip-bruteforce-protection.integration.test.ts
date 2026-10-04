/**
 * Integration tests for IP-based brute force protection
 *
 * Tests the complete login flow with IP-based protection:
 * 1. IP lockout when too many attempts from same IP
 * 2. IP lockout when too many distinct emails attempted
 * 3. IP spray evidence survives successful login
 * 4. Integration with account-level protection
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import {
  getFailedAttemptByIP,
  isIPLocked,
  recordFailedAttemptByIP,
} from "../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import { clearRateLimiters } from "../../../apps/backend/src/middlewares/rate-limit.js";
import {
  truncateAll,
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  createTestIp,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { v4 as uuidv4 } from "uuid";

/** Four emails keeps each account under lockout (5) while IP total can reach 10. */
const ACCOUNT_SAFE_EMAILS = [
  "ip-a@example.com",
  "ip-b@example.com",
  "ip-c@example.com",
  "ip-d@example.com",
];

async function postLogin(ipAddress: string, email: string, password = "WrongPassword123!") {
  return request(app)
    .post("/api/v1/auth/login")
    .set("X-Forwarded-For", ipAddress)
    .send({ email, password });
}

async function failLoginsWithoutAccountLock(ipAddress: string, count: number) {
  const responses = [];
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 9 === 0) {
      clearRateLimiters();
    }
    responses.push(await postLogin(ipAddress, ACCOUNT_SAFE_EMAILS[i % ACCOUNT_SAFE_EMAILS.length]));
  }
  return responses;
}

async function seedIpAttemptCount(ipAddress: string, count: number) {
  for (let i = 0; i < count; i++) {
    await recordFailedAttemptByIP(ipAddress, "ip-counter@example.com");
  }
}

describeWithTestDatabase("Integration: IP-Based Brute Force Protection", () => {
  beforeAll(async () => {
    // Ensure username column exists before tests run
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    try {
      // Ensure read-only mode is disabled for tests
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;
      // Use X-Forwarded-For in tests so each test's unique IP is used
      // instead of the shared socket IP (127.0.0.1)
      (env as { trustProxy: boolean }).trustProxy = true;

      // Clear rate limiters to prevent interference between tests
      clearRateLimiters();

      await truncateAll();
      await ensureRolesSeeded();
    } catch (error) {
      // Re-throw with more context for debugging
      let errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Handle AggregateError - check for ECONNREFUSED which indicates database connection issue
      if (error instanceof AggregateError) {
        const errorCode = (error as { code?: string }).code;
        if (errorCode === "ECONNREFUSED") {
          errorMessage = `Database connection refused (ECONNREFUSED). Ensure PostgreSQL is running and accessible. Check PGHOST, PGPORT, PGUSER, PGPASSWORD, and PGDATABASE environment variables.`;
        } else {
          // Handle other AggregateError cases
          const errorDetails: string[] = [];
          errorDetails.push(`AggregateError: ${error.message || "no message"}`);
          if (errorCode) {
            errorDetails.push(`Error code: ${errorCode}`);
          }
          if (error.errors && error.errors.length > 0) {
            errorDetails.push(`Contains ${error.errors.length} error(s):`);
            error.errors.forEach((e, i) => {
              const msg = e instanceof Error ? e.message : String(e);
              const code = (e as { code?: string }).code;
              errorDetails.push(`  Error ${i + 1}: ${msg}${code ? ` (code: ${code})` : ""}`);
            });
          }
          errorMessage = errorDetails.join("\n");
        }
      } else if ((error as { code?: string }).code === "ECONNREFUSED") {
        errorMessage = `Database connection refused (ECONNREFUSED). Ensure PostgreSQL is running and accessible.`;
      }

      throw new Error(
        `beforeEach failed: ${errorMessage}${errorStack ? `\nStack: ${errorStack}` : ""}`,
      );
    }
  });

  afterEach(async () => {
    await truncateAll();
  });

  describe("IP Lockout - Too Many Attempts", () => {
    it("should lock IP after 10 failed login attempts", async () => {
      const ipAddress = createTestIp();

      const firstNine = await failLoginsWithoutAccountLock(ipAddress, 9);
      for (const response of firstNine) {
        expect(response.status).toBe(200);
        if (response.status === 429) {
          expect(response.body.error.code).not.toBe("AUTH_ACCOUNT_LOCKED");
        }
      }

      // Check IP is not locked yet
      const attempt9 = await getFailedAttemptByIP(ipAddress);
      if (attempt9) {
        expect(attempt9.locked_until).toBeNull();
      } else {
        // No record yet means not locked
        expect(attempt9).toBeNull();
      }

      // 10th attempt triggers internal IP throttling but keeps the public
      // response indistinguishable from earlier credential attempts.
      const response10 = await postLogin(ipAddress, ACCOUNT_SAFE_EMAILS[1]);

      expect(response10.status).toBe(200);
      expect(response10.body.requires2FA).toBe(true);
      expect(response10.body.pendingSessionId).toEqual(expect.any(String));
      expect(response10.body.error).toBeUndefined();

      // Verify IP is locked
      const attempt10 = await getFailedAttemptByIP(ipAddress);
      expect(attempt10?.locked_until).not.toBeNull();
      expect(isIPLocked(attempt10)).toBe(true);
    });

    it("should lock IP after 5 distinct email attempts", async () => {
      const ipAddress = createTestIp();

      // Make 4 failed attempts with different emails (should not lock yet)
      for (let i = 1; i <= 4; i++) {
        const response = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", ipAddress)
          .send({
            email: `user${i}@example.com`,
            password: "WrongPassword123!",
          });

        expect(response.status).toBe(200);
      }

      // Check IP is not locked yet
      const attempt4 = await getFailedAttemptByIP(ipAddress);
      expect(attempt4).not.toBeNull();
      expect(attempt4?.distinct_email_count).toBe(4);
      expect(attempt4?.locked_until).toBeNull();

      // 5th distinct email should trigger IP lockout
      const response5 = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email: "user5@example.com",
          password: "WrongPassword123!",
        });

      expect(response5.status).toBe(200);
      expect(response5.body.requires2FA).toBe(true);
      expect(response5.body.error).toBeUndefined();

      // Verify IP is locked
      const attempt5 = await getFailedAttemptByIP(ipAddress);
      expect(attempt5?.distinct_email_count).toBe(5);
      expect(attempt5?.locked_until).not.toBeNull();
      expect(isIPLocked(attempt5)).toBe(true);
    });

    it("should prevent login from locked IP even with correct credentials", async () => {
      const ipAddress = createTestIp();
      const email = "valid@example.com";
      const password = "ValidPassword123!";

      // Create a valid user with verified email
      const passwordHash = await bcrypt.hash(password, 12);
      await createUser({
        id: uuidv4(),
        username: "validuser",
        display_name: "Valid User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      await failLoginsWithoutAccountLock(ipAddress, 10);

      // Verify IP is locked
      const lockedAttempt = await getFailedAttemptByIP(ipAddress);
      expect(isIPLocked(lockedAttempt)).toBe(true);

      clearRateLimiters();

      // Try to login with valid credentials from locked IP
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.user).toBeUndefined();
    });
  });

  describe("IP Spray Evidence on Successful Login", () => {
    it("should preserve IP spray attempts on successful login", async () => {
      const ipAddress = createTestIp();
      const email = "success@example.com";
      const password = "ValidPassword123!";

      // Create a valid user with verified email
      const passwordHash = await bcrypt.hash(password, 12);
      await createUser({
        id: uuidv4(),
        username: "successuser",
        display_name: "Success User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      // Make some failed attempts
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", ipAddress)
          .send({
            email: `test${i}@example.com`,
            password: "WrongPassword123!",
          });
      }

      // Verify IP has attempts recorded
      const beforeLogin = await getFailedAttemptByIP(ipAddress);
      expect(beforeLogin).not.toBeNull();
      expect(beforeLogin?.total_attempt_count).toBeGreaterThan(0);

      // Successful login must not erase aggregate IP spray evidence
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password,
        });

      expect(loginResponse.status).toBe(200);

      // Aggregate IP evidence remains after a valid account authenticates.
      const afterLogin = await getFailedAttemptByIP(ipAddress);
      expect(afterLogin).not.toBeNull();
      expect(afterLogin?.total_attempt_count).toBe(beforeLogin?.total_attempt_count);
    });

    it("should preserve IP spray evidence while clearing the successful account pair", async () => {
      const ipAddress = createTestIp();
      const email = "mixed@example.com";
      const password = "ValidPassword123!";

      // Create a valid user with verified email
      const passwordHash = await bcrypt.hash(password, 12);
      await createUser({
        id: uuidv4(),
        username: "mixeduser",
        display_name: "Mixed User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      // Make failed attempts with this email (creates account-level record)
      for (let i = 0; i < 2; i++) {
        await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ipAddress).send({
          email,
          password: "WrongPassword123!",
        });
      }

      // Make failed attempts with other emails (creates IP-level record)
      for (let i = 1; i <= 2; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", ipAddress)
          .send({
            email: `other${i}@example.com`,
            password: "WrongPassword123!",
          });
      }

      // Verify both records exist
      const ipAttempts = await getFailedAttemptByIP(ipAddress);
      expect(ipAttempts).not.toBeNull();

      // Successful login clears only the identifier+IP pair, not aggregate IP evidence
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password,
        });

      expect(loginResponse.status).toBe(200);

      const afterLogin = await getFailedAttemptByIP(ipAddress);
      expect(afterLogin).not.toBeNull();
      expect(afterLogin?.total_attempt_count).toBe(ipAttempts?.total_attempt_count);
    });
  });

  describe("IP Protection vs Account Protection", () => {
    it("should check IP lockout before account lockout", async () => {
      const ipAddress = createTestIp();
      const email = "test@example.com";

      await failLoginsWithoutAccountLock(ipAddress, 10);

      // Verify IP is locked
      const ipAttempt = await getFailedAttemptByIP(ipAddress);
      expect(ipAttempt).not.toBeNull();
      expect(isIPLocked(ipAttempt)).toBe(true);

      clearRateLimiters();

      // Try to login with a specific email (account-level would not be locked yet)
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password: "WrongPassword123!",
        });

      // The IP throttle wins internally, but its reason is not exposed.
      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.error).toBeUndefined();
    });

    it("should allow account-level lockout when IP is not locked", async () => {
      const ipAddress = createTestIp();
      const email = "account@example.com";

      // Make 5 failed attempts with same email (triggers account-level lockout)
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ipAddress).send({
          email,
          password: "WrongPassword123!",
        });
      }

      // Verify IP is not locked (only 5 attempts, same email)
      const ipAttempt = await getFailedAttemptByIP(ipAddress);
      expect(ipAttempt).not.toBeNull();
      expect(ipAttempt?.total_attempt_count).toBe(5);
      expect(ipAttempt?.distinct_email_count).toBe(1);
      expect(isIPLocked(ipAttempt)).toBe(false);

      // The account-level throttle is internal; the public response remains
      // the same opaque challenge and discloses no lockout reason.
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.error).toBeUndefined();
    });
  });

  describe("Progressive Lockout Durations", () => {
    it("should apply 30-minute lockout for 10 attempts", async () => {
      const ipAddress = createTestIp();

      await failLoginsWithoutAccountLock(ipAddress, 10);

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt).not.toBeNull();
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffMinutes = (lockoutTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(29);
      expect(diffMinutes).toBeLessThanOrEqual(31);
    });

    it("should apply 2-hour lockout for 20 attempts", async () => {
      const ipAddress = createTestIp();

      await seedIpAttemptCount(ipAddress, 20);

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt).not.toBeNull();
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(1.9);
      expect(diffHours).toBeLessThanOrEqual(2.1);
    });

    it("should apply 24-hour lockout for 50 attempts", async () => {
      const ipAddress = createTestIp();

      await seedIpAttemptCount(ipAddress, 50);

      const attempt = await getFailedAttemptByIP(ipAddress);
      expect(attempt).not.toBeNull();
      expect(attempt?.locked_until).not.toBeNull();

      const lockoutTime = new Date(attempt!.locked_until!);
      const now = new Date();
      const diffHours = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });
  });

  describe("Different IP Addresses", () => {
    it("should track attempts separately for different IPs", async () => {
      const ip1 = createTestIp();
      const ip2 = createTestIp();

      await failLoginsWithoutAccountLock(ip1, 10);
      await failLoginsWithoutAccountLock(ip2, 4);

      // Verify IP1 is locked
      const attempt1 = await getFailedAttemptByIP(ip1);
      expect(isIPLocked(attempt1)).toBe(true);

      // Verify IP2 is not locked
      const attempt2 = await getFailedAttemptByIP(ip2);
      expect(attempt2?.locked_until).toBeNull();

      // IP2 should still be able to attempt login
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ip2)
        .send({
          email: "test6@example.com",
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200); // Should not be IP-locked
    });
  });
});
