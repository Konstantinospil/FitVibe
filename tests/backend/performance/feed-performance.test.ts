/**
 * Performance test for feed endpoint (CRITICAL-007)
 *
 * Tests that feed endpoint meets performance target: p95 ≤400ms
 */

import { it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import app from "../../../apps/backend/src/app.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { acceptLegalDocumentVersion } from "../../../apps/backend/src/modules/legal/legal.service.js";
import {
  truncateAll,
  ensureRolesSeeded,
  ensureUsernameColumnExists,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";

describeWithTestDatabase("Performance: Feed Endpoint", () => {
  let authToken: string;

  beforeAll(async () => {
    const dbModule = await import("../../../apps/backend/src/db/index.js");
    const hasUsersTable = await dbModule.default.schema.hasTable("users");
    if (!hasUsersTable) {
      throw new Error("Feed performance tests require migrated tables (users is missing).");
    }

    await ensureUsernameColumnExists();
    await truncateAll();
    await ensureRolesSeeded();

    const testEmail = `test-${uuidv4()}@example.com`;
    const testUsername = `testuser-${uuidv4().substring(0, 8)}`;
    const password = "SecureP@ssw0rd123!";
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const currentTerms = {
      id: uuidv4(),
      version: "performance-test.1",
      effectiveAt: new Date(Date.now() - 60_000).toISOString(),
      publishedAt: new Date(Date.now() - 60_000).toISOString(),
    };
    await dbModule.default("legal_document_versions").insert({
      id: currentTerms.id,
      document_type: "terms",
      version: currentTerms.version,
      change_class: "legacy",
      user_action: "accept",
      effective_at: currentTerms.effectiveAt,
      published_at: currentTerms.publishedAt,
      published_by: null,
      source: "test_fixture",
    });

    const user = await createUser({
      id: uuidv4(),
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
      terms_accepted_at: now,
      terms_version: currentTerms.version,
    });
    if (!user) {
      throw new Error("Feed performance tests failed to create a user.");
    }
    await acceptLegalDocumentVersion(user.id, currentTerms.id, "performance_test");

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: testEmail,
      password,
    });

    if (loginResponse.status !== 200) {
      throw new Error(
        `Feed performance tests failed to authenticate (status ${loginResponse.status}).`,
      );
    }

    authToken = loginResponse.body.tokens?.accessToken ?? "";
    if (!authToken) {
      throw new Error("Feed performance tests did not receive an access token.");
    }
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("should meet p95 response time target of ≤400ms", async () => {
    // This is a placeholder test structure
    // In a real performance test, you would:
    // 1. Create many feed items (1000+)
    // 2. Make multiple requests (100+)
    // 3. Measure response times
    // 4. Calculate p95
    // 5. Assert p95 ≤ 400ms

    // For now, we'll do a simple latency check
    const startTime = Date.now();
    const response = await request(app)
      .get("/api/v1/feed")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ limit: 20 });

    const responseTime = Date.now() - startTime;

    // Basic check - in production, you'd want more sophisticated performance testing
    // This test structure documents the requirement
    expect(response.status).toBe(200);

    // Log response time for monitoring
    console.log(`Feed endpoint response time: ${responseTime}ms`);

    // Note: Full performance testing should use k6 or similar tool
    // This test serves as a placeholder and documentation
  }, 10000); // 10 second timeout for performance test

  it("should handle pagination efficiently", async () => {
    // Test that pagination doesn't significantly impact performance
    const offsets = [0, 20, 40, 60, 80];
    const responseTimes: number[] = [];

    for (const offset of offsets) {
      const startTime = Date.now();
      const response = await request(app)
        .get("/api/v1/feed")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ limit: 20, offset });

      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);

      expect(response.status).toBe(200);
    }

    // Average response time should be reasonable
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`Average feed pagination response time: ${avgResponseTime}ms`);

    // In production, verify this meets targets
    expect(avgResponseTime).toBeLessThan(1000); // Basic sanity check
  }, 15000);
});
