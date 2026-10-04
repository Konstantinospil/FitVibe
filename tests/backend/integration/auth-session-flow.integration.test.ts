/**
 * Integration test for complete authentication and session flow
 *
 * Tests the cross-module flow:
 * 1. User registration
 * 2. Email verification
 * 3. User login
 * 4. Session creation
 * 5. Session completion
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
  withDatabaseErrorHandling,
  ensureUsernameColumnExists,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { v4 as uuidv4 } from "uuid";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { seed as seedLegalPublications } from "../../../apps/backend/src/db/seeds/005_legal_publications.js";

describeWithTestDatabase("Integration: Auth → Session Flow", () => {
  beforeAll(async () => {
    // Ensure username column exists before tests run
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      // Ensure read-only mode is disabled for tests
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      // Clean up any existing test data
      await truncateAll();
      // Registration requires an explicit authoritative Terms publication.
      // Keep the integration fixture aligned with a fresh deployed database:
      // schema migration first, then deterministic catalog/legal seeds.
      await seedLegalPublications(db);
      // Ensure roles are seeded before creating users
      await ensureRolesSeeded();
    }, "beforeEach");
  });

  afterEach(async () => {
    // Ensure cleanup after each test
    await truncateAll();
  });

  it("should complete full flow: register → verify → login → create session", async () => {
    // Step 1: Register a new user via API
    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      email: "testuser@example.com",
      username: "testuser",
      password: "SecureP@ssw0rd123!",
      terms_accepted: true,
    });

    expect(registerResponse.status).toBe(202);
    expect(registerResponse.body).toHaveProperty("message");
    expect(registerResponse.body).toHaveProperty("debugVerificationToken");

    const verificationToken = registerResponse.body.debugVerificationToken;
    expect(verificationToken).toBeTruthy();

    // Get user ID from database since registration response doesn't include user object
    // primary_email is a computed field from user_contacts, so we need to join or use findUserByEmail
    const { findUserByEmail } =
      await import("../../../apps/backend/src/modules/auth/auth.repository.js");
    const user = await findUserByEmail("testuser@example.com");
    expect(user).toBeDefined();
    expect(user?.status).toBe("pending_verification");
    const userId = user?.id;
    expect(userId).toBeDefined();

    // Step 2: Verify email via API (GET /verify with token query parameter)
    const verifyResponse = await request(app).get("/api/v1/auth/verify").query({
      token: verificationToken,
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.user.status).toBe("active");

    // Verify user can be found by email before login (same query login uses)
    // Reuse findUserByEmail from earlier import
    let foundUser = await findUserByEmail("testuser@example.com");
    let retries = 0;
    while ((!foundUser || foundUser.status !== "active") && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      foundUser = await findUserByEmail("testuser@example.com");
      retries++;
    }
    if (!foundUser || foundUser.status !== "active") {
      throw new Error(
        `User not found or not active after ${retries} retries. User: ${foundUser ? JSON.stringify({ id: foundUser.id, status: foundUser.status }) : "null"}`,
      );
    }

    // Step 3: Login via API
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "testuser@example.com",
      password: "SecureP@ssw0rd123!",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("tokens");
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body.user.status).toBe("active");

    const accessToken = loginResponse.body.tokens.accessToken;

    // Step 4: Create a session via API
    const sessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Morning Workout",
        planned_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        visibility: "private",
        exercises: [],
      });

    if (sessionResponse.status !== 201) {
      throw new Error(
        `Failed to create session: ${sessionResponse.status} - ${JSON.stringify(sessionResponse.body)}`,
      );
    }
    expect(sessionResponse.body).toMatchObject({
      title: "Morning Workout",
      status: "planned",
      visibility: "private",
    });
    expect(sessionResponse.body.owner_id || sessionResponse.body.userId).toBe(userId);

    // Verify session was created in database
    const sessionInDb = await db("sessions").where({ id: sessionResponse.body.id }).first();
    expect(sessionInDb).toBeDefined();
    expect(sessionInDb.owner_id).toBe(userId);
  });

  it("should handle login failure with incorrect password", async () => {
    // Create a verified user directly in database
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash("CorrectPassword123!", 12);
    const now = new Date().toISOString();

    const userResult = await createUser({
      id: userId,
      username: "existinguser",
      display_name: "Existing User",
      status: "active",
      role_code: "athlete",
      password_hash: passwordHash,
      primaryEmail: "existing@example.com",
      emailVerified: true,
      terms_accepted: true,
      terms_accepted_at: now,
      terms_version: getCurrentTermsVersion(),
    });

    if (!userResult) {
      throw new Error("Failed to create user for login failure test");
    }

    // Verify user exists and can be found by email
    const verifyUser = await db("users").where({ id: userId }).first();
    if (!verifyUser) {
      throw new Error(`User ${userId} was not created in database`);
    }

    // Verify email contact was created
    const verifyContact = await db("user_contacts")
      .where({ user_id: userId, type: "email", is_primary: true })
      .first();
    if (!verifyContact) {
      throw new Error(`User email contact was not created in database`);
    }

    // Verify user can be found by email (same query login uses)
    const { findUserByEmail } =
      await import("../../../apps/backend/src/modules/auth/auth.repository.js");
    let foundUser = await findUserByEmail("existing@example.com");
    let retries = 0;
    while (!foundUser && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      foundUser = await findUserByEmail("existing@example.com");
      retries++;
    }
    if (!foundUser) {
      throw new Error(
        `User not found by email after ${retries} retries. User exists: ${!!verifyUser}, Contact exists: ${!!verifyContact}`,
      );
    }

    // Attempt login with wrong password
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "existing@example.com",
      password: "WrongPassword123!",
    });

    // Phase 14: invalid credentials continue into an opaque pre-authentication
    // challenge so the response does not disclose whether the password was correct
    // or whether the account uses 2FA. No authenticated state is issued.
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({
      requires2FA: true,
      pendingSessionId: expect.any(String),
    });
    expect(loginResponse.body.user).toBeUndefined();
    expect(loginResponse.body.session).toBeUndefined();
    expect(loginResponse.body.tokens).toBeUndefined();
  });

  it("should prevent creating session without authentication", async () => {
    const sessionResponse = await request(app).post("/api/v1/sessions").send({
      title: "Unauthorized Session",
      scheduledAt: new Date().toISOString(),
      status: "planned",
      privacy: "private",
      exercises: [],
    });

    expect(sessionResponse.status).toBe(401);
  });
});
