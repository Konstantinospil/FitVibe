import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { reconcileGamificationProjection } from "../../../apps/backend/src/modules/points/gamification-projection.service.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";

const HOUR = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

/**
 * ADR-042 against real Postgres: a set's prescription is separate from what was
 * performed, only completed sets score, and a past workout can be logged in one
 * request (US-5.1, #289).
 */
describeWithTestDatabase("Integration: session logging (ADR-042)", () => {
  let athlete: SignedInAthlete;
  let exerciseId: string;

  const post = (body: Record<string, unknown>) =>
    request(app).post("/api/v1/sessions").set("Authorization", athlete.bearer).send(body);
  const patch = (id: string, body: Record<string, unknown>) =>
    request(app).patch(`/api/v1/sessions/${id}`).set("Authorization", athlete.bearer).send(body);
  const awardedPoints = async (sessionId: string) => {
    await reconcileGamificationProjection(athlete.userId, { sessionId });
    const row = await db("sessions").where({ id: sessionId }).first("points");
    return Number(row.points);
  };

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    athlete = await signInNewAthlete(app, "log");
    exerciseId = uuidv4();
    await db("exercises").insert({
      id: exerciseId,
      name: "Back Squat",
      type_code: "strength",
      owner_id: athlete.userId,
      is_public: false,
    });
  });

  it("stores a planned workout's targets as its prescription, not as performed work", async () => {
    const response = await post({
      planned_at: hoursFromNow(24),
      exercises: [
        { order: 1, exercise_id: exerciseId, sets: [{ order: 1, reps: 5, weight_kg: 100 }] },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.exercises[0].sets[0]).toMatchObject({
      status: "planned",
      source: "prescribed",
      planned: expect.objectContaining({ reps: 5, weight_kg: 100 }),
      reps: null,
      weight_kg: null,
    });
  });

  it("logs a past workout in one request, scoring only the completed sets", async () => {
    const plannedAt = hoursFromNow(-3);
    const response = await post({
      status: "completed",
      title: "Leg day",
      planned_at: plannedAt,
      planned_duration_min: 45,
      exercises: [
        {
          order: 1,
          exercise_id: exerciseId,
          sets: [
            {
              order: 1,
              status: "completed",
              planned: { reps: 5, weight_kg: 100 },
              reps: 5,
              weight_kg: 100,
            },
            { order: 2, status: "completed", source: "added", reps: 8, weight_kg: 80 },
            { order: 3, status: "skipped", planned: { reps: 5, weight_kg: 100 } },
          ],
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "completed",
      completion_outcome: "completed",
      started_at: new Date(plannedAt).toISOString(),
      completed_at: new Date(new Date(plannedAt).getTime() + 45 * 60_000).toISOString(),
    });
    expect(response.body.exercises[0].sets.map((set: { status: string }) => set.status)).toEqual([
      "completed",
      "completed",
      "skipped",
    ]);

    // The same workout completed without recording anything scores no volume.
    const unrecorded = await post({
      planned_at: hoursFromNow(-6),
      exercises: [
        {
          order: 1,
          exercise_id: exerciseId,
          sets: [
            { order: 1, planned: { reps: 5, weight_kg: 100 } },
            { order: 2, planned: { reps: 8, weight_kg: 80 } },
          ],
        },
      ],
    });
    expect((await patch(unrecorded.body.id, { status: "completed" })).status).toBe(200);

    expect(await awardedPoints(response.body.id)).toBeGreaterThan(
      await awardedPoints(unrecorded.body.id),
    );
  });

  it("refuses a log that starts in the future", async () => {
    const response = await post({ status: "completed", planned_at: hoursFromNow(1) });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("E.SESSION.LOG_IN_FUTURE");
  });

  it("records a stopped-early outcome only when completing, and clears it on reopen", async () => {
    const session = await post({ planned_at: hoursFromNow(-2) });

    const early = await patch(session.body.id, { completion_outcome: "stopped_early" });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe("E.SESSION.OUTCOME_WITHOUT_COMPLETION");

    const completed = await patch(session.body.id, {
      status: "completed",
      completion_outcome: "stopped_early",
    });
    expect(completed.status).toBe(200);
    expect(completed.body.completion_outcome).toBe("stopped_early");

    const reopened = await request(app)
      .post(`/api/v1/sessions/${session.body.id}/reopen`)
      .set("Authorization", athlete.bearer);
    expect(reopened.status).toBe(200);
    expect(reopened.body.completion_outcome).toBeNull();
  });

  it("rejects contradictory sets", async () => {
    for (const set of [
      { order: 1, status: "planned", planned: { reps: 5 }, reps: 5 },
      { order: 1, status: "skipped", reps: 5 },
    ]) {
      const response = await post({
        planned_at: hoursFromNow(24),
        exercises: [{ order: 1, exercise_id: exerciseId, sets: [set] }],
      });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("E.SESSION.INVALID_SET");
    }
  });

  it("reuses a logged workout as a prescription", async () => {
    const logged = await post({
      status: "completed",
      planned_at: hoursFromNow(-3),
      exercises: [
        {
          order: 1,
          exercise_id: exerciseId,
          sets: [
            { order: 1, status: "completed", reps: 6, weight_kg: 90 },
            { order: 2, status: "skipped" },
          ],
        },
      ],
    });

    const reused = await request(app)
      .post(`/api/v1/sessions/${logged.body.id}/clone`)
      .set("Authorization", athlete.bearer)
      .send({ planned_at: hoursFromNow(48) });

    expect(reused.status).toBe(201);
    expect(reused.body.exercises[0].sets).toEqual([
      expect.objectContaining({
        order_index: 1,
        status: "planned",
        planned: expect.objectContaining({ reps: 6, weight_kg: 90 }),
        reps: null,
      }),
    ]);
  });
});
