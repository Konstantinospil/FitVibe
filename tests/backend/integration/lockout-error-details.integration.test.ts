/**
 * Integration tests for lockout error response details
 *
 * Tests that lockout error responses include structured details for frontend UI
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import {
  truncateAll,
  ensureRolesSeeded,
  withDatabaseErrorHandling,
  ensureUsernameColumnExists,
  createTestIp,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";

describeWithTestDatabase("Integration: Lockout Error Details", () => {
  beforeAll(async () => {
    // Ensure username column exists before tests run
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;
      (env as { trustProxy: boolean }).trustProxy = true;

      await truncateAll();
      await ensureRolesSeeded();
    }, "beforeEach");
  });

  afterEach(async () => {
    await truncateAll();
  });

  describe("Account Throttle Concealment", () => {
    it("should conceal an active account throttle behind the opaque challenge", async () => {
      const email = "locked@example.com";
      const password = "ValidPassword123!";
      const ipAddress = createTestIp();

      // Create a valid user
      const passwordHash = await bcrypt.hash(password, 12);
      await createUser({
        id: uuidv4(),
        username: "lockeduser",
        display_name: "Locked User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      // Make 5 failed attempts to trigger account lockout
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ipAddress).send({
          email,
          password: "WrongPassword123!",
        });
      }

      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.pendingSessionId).toEqual(expect.any(String));
      expect(response.body.error).toBeUndefined();
    });
  });

  describe("IP Throttle Concealment", () => {
    it("should conceal an active IP throttle behind the opaque challenge", async () => {
      const ipAddress = createTestIp();

      // Make 4 failed attempts with different emails to approach the 5 distinct email limit
      // (IP lockout triggers at 10 attempts OR 5 distinct emails)
      // Stay within rate limit of 10 req/min - the 5th distinct email will trigger IP lockout
      for (let i = 1; i <= 4; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", ipAddress)
          .send({
            email: `iplockout${i}@example.com`,
            password: "WrongPassword123!",
          });
      }

      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email: "iplockout5@example.com",
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.pendingSessionId).toEqual(expect.any(String));
      expect(response.body.error).toBeUndefined();
    });
  });

  describe("Pre-Lockout Disclosure", () => {
    it("should not disclose remaining-attempt counters before throttling", async () => {
      const email = "warning@example.com";
      const ipAddress = createTestIp();

      // Create a valid user
      const passwordHash = await bcrypt.hash("ValidPassword123!", 12);
      await createUser({
        id: uuidv4(),
        username: "warninguser",
        display_name: "Warning User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      // Make 2 failed attempts (3 remaining, should trigger warning)
      for (let i = 0; i < 2; i++) {
        await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ipAddress).send({
          email,
          password: "WrongPassword123!",
        });
      }

      // Next attempt should include warning details
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.pendingSessionId).toEqual(expect.any(String));
      expect(response.body.error).toBeUndefined();
    });

    it("should not include warning details when not approaching lockout", async () => {
      const email = "nowarning@example.com";
      const ipAddress = createTestIp();

      // Create a valid user
      const passwordHash = await bcrypt.hash("ValidPassword123!", 12);
      await createUser({
        id: uuidv4(),
        username: "nowarninguser",
        display_name: "No Warning User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: email,
        emailVerified: true,
        terms_version: getCurrentTermsVersion(),
      });

      // Make 0 failed attempts initially - first attempt won't trigger warning
      // (5 remaining attempts, warning threshold is <= 3 remaining)
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", ipAddress)
        .send({
          email,
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.pendingSessionId).toEqual(expect.any(String));
      expect(response.body.error).toBeUndefined();
    });
  });
});
