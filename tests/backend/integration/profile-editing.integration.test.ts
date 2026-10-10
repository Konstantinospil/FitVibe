/**
 * Integration test for profile editing functionality
 *
 * Tests the complete profile editing flow:
 * 1. User registration and login
 * 2. Profile update via PATCH /api/v1/users/me
 * 3. Validation of editable fields (alias, weight, fitness level, training frequency)
 * 4. Immutable field protection (date_of_birth, gender)
 * 5. Weight unit conversion
 * 6. Audit logging
 *
 * Uses real database with transaction-based cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import {
  truncateAll,
  ensureRolesSeeded,
  ensureFitnessLevelsSeeded,
  withDatabaseErrorHandling,
  ensureUsernameColumnExists,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { v4 as uuidv4 } from "uuid";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { clearRateLimiters } from "../../../apps/backend/src/middlewares/rate-limit.js";

describeWithTestDatabase("Integration: Profile Editing", () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    // Clear rate limiters to prevent rate limiting issues between tests
    clearRateLimiters();
    await withDatabaseErrorHandling(async () => {
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      await truncateAll();
      await ensureRolesSeeded();
      await ensureFitnessLevelsSeeded();

      // Create and login a test user
      const testEmail = `test-${uuidv4()}@example.com`;
      const testUsername = `testuser-${uuidv4().substring(0, 8)}`;
      const hashedPassword = await bcrypt.hash("SecureP@ssw0rd123!", 10);

      const userIdValue = uuidv4();
      const user = await createUser({
        id: userIdValue,
        username: testUsername,
        display_name: "Test User",
        password_hash: hashedPassword,
        primaryEmail: testEmail,
        emailVerified: true,
        role_code: "athlete",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: getCurrentTermsVersion(),
      });

      if (!user) {
        throw new Error("Failed to create user");
      }
      userId = user.id;

      // Login to get auth token
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: testEmail,
        password: "SecureP@ssw0rd123!",
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.tokens).toBeDefined();
      authToken = loginResponse.body.tokens.accessToken;
      expect(authToken).toBeTruthy();
    }, "beforeEach");
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("should update alias successfully", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        alias: "testalias",
      });

    expect(response.status).toBe(200);
    expect(response.body.profile?.alias).toBe("testalias");
  });

  it("should update weight with unit conversion", async () => {
    // Test weight in kg
    const responseKg = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        weight: 75,
        weightUnit: "kg",
      });

    expect(responseKg.status).toBe(200);
    expect(responseKg.body.profile?.weight).toBeCloseTo(75, 1);

    // Test weight in lb (should convert to kg internally)
    const responseLb = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        weight: 165,
        weightUnit: "lb",
      });

    expect(responseLb.status).toBe(200);
    // 165 lb ≈ 74.84 kg
    expect(responseLb.body.profile?.weight).toBeCloseTo(74.84, 1);
  });

  it("should update fitness level", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        fitnessLevel: "intermediate",
      });

    expect(response.status).toBe(200);
    expect(response.body.profile?.fitnessLevel).toBe("intermediate");
  });

  it("should update training frequency", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        trainingFrequency: "3_4_per_week",
      });

    expect(response.status).toBe(200);
    expect(response.body.profile?.trainingFrequency).toBe("3_4_per_week");
  });

  it("should update multiple profile fields at once", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        alias: "multitest",
        weight: 80,
        weightUnit: "kg",
        fitnessLevel: "advanced",
        trainingFrequency: "5_plus_per_week",
      });

    expect(response.status).toBe(200);
    expect(response.body.profile?.alias).toBe("multitest");
    expect(response.body.profile?.weight).toBeCloseTo(80, 1);
    expect(response.body.profile?.fitnessLevel).toBe("advanced");
    expect(response.body.profile?.trainingFrequency).toBe("5_plus_per_week");
  });

  it("should reject invalid alias format and aliases longer than 32 characters", async () => {
    const invalidFormat = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        alias: "invalid alias with spaces!",
      });

    expect(invalidFormat.status).toBe(422);
    expect(invalidFormat.body.error?.code).toBe("E.VALIDATION_ERROR");

    const tooLong = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        alias: "a".repeat(33),
      });

    expect(tooLong.status).toBe(422);
    expect(tooLong.body.error?.code).toBe("E.VALIDATION_ERROR");
  });

  it("should reject weight outside valid kg-equivalent range", async () => {
    // Test weight too low
    const responseLow = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        weight: 10,
        weightUnit: "kg",
      });

    expect(responseLow.status).toBe(422);

    const responseHigh = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        weight: 401,
        weightUnit: "kg",
      });

    expect(responseHigh.status).toBe(422);

    const responseHighLb = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        weight: 882,
        weightUnit: "lb",
      });

    expect(responseHighLb.status).toBe(422);
  });

  it("should reject immutable profile fields with the required error code", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        date_of_birth: "2000-01-01",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "E.USER.IMMUTABLE_FIELD",
    });
  });

  it("should reject invalid fitness level", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        fitnessLevel: "invalid_level",
      });

    expect(response.status).toBe(422);
  });

  it("should reject invalid training frequency", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        trainingFrequency: "invalid_frequency",
      });

    expect(response.status).toBe(422);
  });

  it("should verify audit log entry is created", async () => {
    await request(app).patch("/api/v1/users/me").set("Authorization", `Bearer ${authToken}`).send({
      alias: "audittest",
    });

    // Check audit log
    const auditLogs = await db("audit_log")
      .where({ actor_user_id: userId, action: "profile_update" })
      .orderBy("created_at", "desc")
      .limit(1);

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].entity_type).toBe("users");
    expect(auditLogs[0].entity_id).toBe(userId);
    expect(auditLogs[0].metadata).toHaveProperty("changes");
  });

  it("should respond within 500ms", async () => {
    const startTime = Date.now();
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        alias: "perftest",
      });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(500);
  });
});
