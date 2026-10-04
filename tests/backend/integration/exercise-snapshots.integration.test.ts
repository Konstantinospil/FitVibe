/**
 * Integration test for exercise snapshots functionality (E2-A3, US-2.3)
 *
 * Tests that exercise names are stored as snapshots in session_exercises
 * when exercises are added to sessions, and that these snapshots persist
 * even when exercises are modified or archived.
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

describeWithTestDatabase("Integration: Exercise Snapshots", () => {
  let authToken: string;
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      await truncateAll();
      await ensureRolesSeeded();

      // Create and login a test user
      const testEmail = `test-${uuidv4()}@example.com`;
      const testUsername = `testuser-${uuidv4().substring(0, 8)}`;
      const hashedPassword = await bcrypt.hash("SecureP@ssw0rd123!", 10);

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

        terms_accepted_at: new Date().toISOString(),

        terms_version: getCurrentTermsVersion(),
      });

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

      // Ensure exercise_types exist
      await db("exercise_types").insert({
        code: "strength",
        name: "Strength",
        description: "Strength training",
        created_at: new Date().toISOString(),
      });

      // Create a test exercise
      const createExerciseResponse = await request(app)
        .post("/api/v1/exercises")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Original Exercise Name",
          type_code: "strength",
          muscle_group: "chest",
          is_public: false,
        });

      expect(createExerciseResponse.status).toBe(201);
      exerciseId = createExerciseResponse.body.id;
    }, "beforeEach");
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("should store exercise name snapshot when exercise is added to session", async () => {
    // Create a session with the exercise
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const plannedAt = tomorrow.toISOString();

    const createSessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Session",
        planned_at: plannedAt,
        status: "planned",
        visibility: "private",
        exercises: [
          {
            order: 1,
            exercise_id: exerciseId,
            notes: "Test notes",
          },
        ],
      });

    expect(createSessionResponse.status).toBe(201);
    const sessionId = createSessionResponse.body.id;

    // Verify exercise_name snapshot was stored
    const sessionExercise = await db("session_exercises").where({ session_id: sessionId }).first();

    expect(sessionExercise).toBeTruthy();
    expect(sessionExercise.exercise_id).toBe(exerciseId);
    expect(sessionExercise.exercise_name).toBe("Original Exercise Name");
  });

  it("should preserve exercise name snapshot when exercise is modified", async () => {
    // Create a session with the exercise
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const plannedAt = tomorrow.toISOString();

    const createSessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Session",
        planned_at: plannedAt,
        status: "planned",
        visibility: "private",
        exercises: [
          {
            order: 1,
            exercise_id: exerciseId,
          },
        ],
      });

    expect(createSessionResponse.status).toBe(201);
    const sessionId = createSessionResponse.body.id;

    // Get the original snapshot
    const originalSnapshot = await db("session_exercises").where({ session_id: sessionId }).first();
    expect(originalSnapshot.exercise_name).toBe("Original Exercise Name");

    // Modify the exercise name
    const updateResponse = await request(app)
      .put(`/api/v1/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Modified Exercise Name",
      });

    expect(updateResponse.status).toBe(200);

    // Verify snapshot is unchanged
    const preservedSnapshot = await db("session_exercises")
      .where({ session_id: sessionId })
      .first();
    expect(preservedSnapshot.exercise_name).toBe("Original Exercise Name");
    expect(preservedSnapshot.exercise_name).not.toBe("Modified Exercise Name");
  });

  it("should preserve exercise name snapshot when exercise is archived", async () => {
    // Create a session with the exercise
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const plannedAt = tomorrow.toISOString();

    const createSessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Session",
        planned_at: plannedAt,
        status: "planned",
        visibility: "private",
        exercises: [
          {
            order: 1,
            exercise_id: exerciseId,
          },
        ],
      });

    expect(createSessionResponse.status).toBe(201);
    const sessionId = createSessionResponse.body.id;

    // Get the original snapshot
    const originalSnapshot = await db("session_exercises").where({ session_id: sessionId }).first();
    expect(originalSnapshot.exercise_name).toBe("Original Exercise Name");

    // Archive the exercise
    const archiveResponse = await request(app)
      .delete(`/api/v1/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(archiveResponse.status).toBe(204);

    // Verify exercise is archived
    const archivedExercise = await db("exercises").where({ id: exerciseId }).first();
    expect(archivedExercise.archived_at).toBeTruthy();

    // Verify snapshot is preserved
    const preservedSnapshot = await db("session_exercises")
      .where({ session_id: sessionId })
      .first();
    expect(preservedSnapshot.exercise_name).toBe("Original Exercise Name");
  });

  it("should display snapshot name in session details", async () => {
    // Create a session with the exercise
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const plannedAt = tomorrow.toISOString();

    const createSessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Session",
        planned_at: plannedAt,
        status: "planned",
        visibility: "private",
        exercises: [
          {
            order: 1,
            exercise_id: exerciseId,
          },
        ],
      });

    expect(createSessionResponse.status).toBe(201);
    const sessionId = createSessionResponse.body.id;

    // Modify the exercise name
    await request(app)
      .put(`/api/v1/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Modified Exercise Name",
      });

    // Get session details
    const getSessionResponse = await request(app)
      .get(`/api/v1/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(getSessionResponse.status).toBe(200);
    expect(getSessionResponse.body.exercises).toHaveLength(1);
    expect(getSessionResponse.body.exercises[0].exercise_name).toBe("Original Exercise Name");
  });

  it("should handle exercises without exercise_id (null exercise_id)", async () => {
    // Create a session with a null exercise_id (manual exercise entry)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const plannedAt = tomorrow.toISOString();

    const createSessionResponse = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Session",
        planned_at: plannedAt,
        status: "planned",
        visibility: "private",
        exercises: [
          {
            order: 1,
            exercise_id: null,
            notes: "Manual exercise entry",
          },
        ],
      });

    expect(createSessionResponse.status).toBe(201);
    const sessionId = createSessionResponse.body.id;

    // Verify exercise_name is null for null exercise_id
    const sessionExercise = await db("session_exercises").where({ session_id: sessionId }).first();

    expect(sessionExercise).toBeTruthy();
    expect(sessionExercise.exercise_id).toBeNull();
    expect(sessionExercise.exercise_name).toBeNull();
  });
});
