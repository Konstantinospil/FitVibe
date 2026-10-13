import { describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { ensureRolesSeeded, ensureUsernameColumnExists, truncateAll } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";

describeWithTestDatabase("Integration: plan activation", () => {
  let token: string;
  let userId: string;
  let planId: string;
  const start = "2026-11-02";
  const planDates = ["2026-11-02T08:00:00.000Z", "2026-11-04T08:00:00.000Z"];

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    const password = "SecureP@ssw0rd123!";
    userId = uuidv4();
    const email = `plan-${userId}@example.com`;
    await createUser({
      id: userId,
      username: `plan-${userId.slice(0, 8)}`,
      display_name: "Plan Test",
      password_hash: await bcrypt.hash(password, 10),
      primaryEmail: email,
      emailVerified: true,
      role_code: "athlete",
      status: "active",
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: getCurrentTermsVersion(),
    });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.tokens.accessToken;
    const create = await request(app).post("/api/v1/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Training", start_date: start, duration_weeks: 3,
        target_frequency: 2, time_zone: "Europe/Berlin" });
    expect(create.status).toBe(201);
    planId = create.body.id;
    for (const planned_at of planDates) {
      const created = await request(app).post("/api/v1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ plan_id: planId, title: "Strength", planned_at, exercises: [{
          order: 1, exercise_id: null, planned: { sets: 2, reps: 8, rest: "00:01:30" },
          sets: [{ order: 1, reps: 8, rest_sec: 90 }, { order: 2, reps: 8, rest_sec: 90 }],
        }] });
      expect(created.status).toBe(201);
    }
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("creates a full recurring plan without losing prescribed sets", async () => {
    const activation = await request(app).post(`/api/v1/plans/${planId}/activate`)
      .set("Authorization", `Bearer ${token}`).send({});
    expect(activation.status).toBe(200);
    expect(activation.body.session_count).toBe(6);
    expect(Number(activation.body.progress_percent)).toBe(0);

    const sessions = await db("sessions").where({ plan_id: planId }).orderBy("planned_at");
    expect(sessions).toHaveLength(6);
    expect(sessions.every((session) => session.status === "planned")).toBe(true);
    const exerciseRows = await db("session_exercises")
      .whereIn("session_id", sessions.map((session) => session.id));
    expect(exerciseRows).toHaveLength(6);
    const sets = await db("exercise_sets")
      .whereIn("session_exercise_id", exerciseRows.map((row) => row.id));
    expect(sets).toHaveLength(12);
    expect(sets.every((set) => set.rest_sec === 90 && set.recorded_at === null)).toBe(true);

    const repeated = await request(app).post(`/api/v1/plans/${planId}/activate`)
      .set("Authorization", `Bearer ${token}`).send({});
    expect(repeated.status).toBe(409);
    expect(await db("sessions").where({ plan_id: planId }).count("* as count").first())
      .toMatchObject({ count: "6" });
  });

  it("updates completion progress from persisted session status", async () => {
    expect((await request(app).post(`/api/v1/plans/${planId}/activate`)
      .set("Authorization", `Bearer ${token}`).send({})).status).toBe(200);
    const first = await db("sessions").where({ plan_id: planId }).first();
    const completed = await request(app).patch(`/api/v1/sessions/${first.id}`)
      .set("Authorization", `Bearer ${token}`).send({ status: "completed" });
    expect(completed.status).toBe(200);
    const plan = await db("plans").where({ id: planId }).first();
    expect(plan.completed_count).toBe(1);
    expect(plan.session_count).toBe(6);
    expect(Number(plan.progress_percent)).toBeCloseTo(100 / 6, 2);
  });

  it("rejects activating a plan owned by another user", async () => {
    const unauthorized = await request(app).post(`/api/v1/plans/${planId}/activate`).send({});
    expect(unauthorized.status).toBe(401);
    expect((await db("plans").where({ id: planId }).first()).activated_at).toBeNull();
  });

  it("validates duration/frequency with 422", async () => {
    for (const invalid of [{ duration_weeks: 0 }, { duration_weeks: 53 },
      { target_frequency: 0 }, { target_frequency: 8 }]) {
      const response = await request(app).patch(`/api/v1/plans/${planId}`)
        .set("Authorization", `Bearer ${token}`).send(invalid);
      expect(response.status).toBe(422);
    }
  });
});
