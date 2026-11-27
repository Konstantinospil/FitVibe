import { it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";

type SessionBody = {
  id: string;
  status: string;
  paused_at: string | null;
  paused_seconds: number;
  completion_outcome: string | null;
  exercises: Array<{
    id: string;
    status: string;
    source: string;
    sets: Array<{
      id: string;
      status: string;
      source: string;
      reps: number | null;
      recorded_at: string | null;
    }>;
  }>;
};

/**
 * Live workout execution against real Postgres (ADR-043, #365): record, correct
 * and skip sets, add work, skip exercises, pause and resume, and finish.
 */
describeWithTestDatabase("Integration: live workout execution (ADR-043)", () => {
  let athlete: SignedInAthlete;
  let exerciseId: string;

  const api = (method: "post" | "patch" | "get", path: string, body?: object) => {
    const agent = request(app);
    const url = `/api/v1/sessions${path}`;
    const call = (
      method === "post" ? agent.post(url) : method === "patch" ? agent.patch(url) : agent.get(url)
    ).set("Authorization", athlete.bearer);
    return body ? call.send(body) : call;
  };

  const startWorkout = async () => {
    const created = await api("post", "", {
      planned_at: new Date(Date.now() - 600_000).toISOString(),
      exercises: [
        {
          order: 1,
          exercise_id: exerciseId,
          sets: [
            { order: 1, planned: { reps: 8, weight_kg: 40 } },
            { order: 2, planned: { reps: 8, weight_kg: 40 } },
          ],
        },
        { order: 2, exercise_id: exerciseId, sets: [{ order: 1, planned: { reps: 5 } }] },
      ],
    });
    expect(created.status).toBe(201);
    const started = await api("patch", `/${created.body.id}`, { status: "in_progress" });
    expect(started.status).toBe(200);
    return started.body as SessionBody;
  };

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    athlete = await signInNewAthlete(app, "live");
    await db("exercise_types")
      .insert({ code: "strength", name: "Strength", description: "Strength training" })
      .onConflict("code")
      .ignore();
    exerciseId = uuidv4();
    await db("exercises").insert({
      id: exerciseId,
      name: "Bent-over row",
      type_code: "strength",
      owner_id: athlete.userId,
      is_public: false,
    });
  });

  it("records a set, keeps its first recorded time when corrected, and skips another", async () => {
    const session = await startWorkout();
    const [first, second] = session.exercises[0].sets;

    const recorded = await api("patch", `/${session.id}/sets/${first.id}`, {
      status: "completed",
      reps: 7,
      weight_kg: 40,
    });
    expect(recorded.status).toBe(200);
    const recordedAt = (recorded.body as SessionBody).exercises[0].sets[0].recorded_at;
    expect(recordedAt).toBeTruthy();

    const corrected = await api("patch", `/${session.id}/sets/${first.id}`, {
      status: "completed",
      reps: 8,
      weight_kg: 40,
    });
    expect((corrected.body as SessionBody).exercises[0].sets[0]).toMatchObject({
      reps: 8,
      recorded_at: recordedAt,
    });

    const skipped = await api("patch", `/${session.id}/sets/${second.id}`, { status: "skipped" });
    expect((skipped.body as SessionBody).exercises[0].sets[1]).toMatchObject({
      status: "skipped",
      reps: null,
      recorded_at: null,
    });

    const contradictory = await api("patch", `/${session.id}/sets/${second.id}`, {
      status: "skipped",
      reps: 3,
    });
    expect(contradictory.status).toBe(422);
  });

  it("adds a set once per idempotency key, adds an exercise and skips one", async () => {
    const session = await startWorkout();
    const exerciseRow = session.exercises[0].id;
    const key = uuidv4();
    const addSet = () =>
      api("post", `/${session.id}/exercises/${exerciseRow}/sets`, { planned: { reps: 6 } }).set(
        "Idempotency-Key",
        key,
      );

    expect((await addSet()).status).toBe(201);
    const retried = await addSet();
    expect(retried.status).toBe(201);
    expect((retried.body as SessionBody).exercises[0].sets).toHaveLength(3);
    expect((retried.body as SessionBody).exercises[0].sets[2]).toMatchObject({
      status: "planned",
      source: "added",
    });

    const skipped = await api("post", `/${session.id}/exercises/${session.exercises[1].id}/skip`);
    expect((skipped.body as SessionBody).exercises[1]).toMatchObject({
      status: "skipped",
      sets: [expect.objectContaining({ status: "skipped" })],
    });

    const added = await api("post", `/${session.id}/exercises`, { exercise_id: exerciseId });
    expect(added.status).toBe(201);
    expect((added.body as SessionBody).exercises[2]).toMatchObject({
      status: "planned",
      source: "added",
      sets: [expect.objectContaining({ status: "planned", source: "added" })],
    });
  });

  it("pauses and resumes idempotently and folds an open pause into the finish", async () => {
    const session = await startWorkout();

    const paused = await api("post", `/${session.id}/pause`);
    const pausedAgain = await api("post", `/${session.id}/pause`);
    expect((pausedAgain.body as SessionBody).paused_at).toBe(
      (paused.body as SessionBody).paused_at,
    );

    await db("sessions")
      .where({ id: session.id })
      .update({ paused_at: new Date(Date.now() - 90_000).toISOString() });
    const resumed = await api("post", `/${session.id}/resume`);
    expect(resumed.body).toMatchObject({ paused_at: null });
    expect((resumed.body as SessionBody).paused_seconds).toBeGreaterThanOrEqual(89);
    const afterResume = (resumed.body as SessionBody).paused_seconds;
    expect(((await api("post", `/${session.id}/resume`)).body as SessionBody).paused_seconds).toBe(
      afterResume,
    );

    await api("post", `/${session.id}/pause`);
    await db("sessions")
      .where({ id: session.id })
      .update({ paused_at: new Date(Date.now() - 30_000).toISOString() });
    const finished = await api("patch", `/${session.id}`, {
      status: "completed",
      completion_outcome: "stopped_early",
    });
    expect(finished.body).toMatchObject({
      status: "completed",
      completion_outcome: "stopped_early",
      paused_at: null,
    });
    expect((finished.body as SessionBody).paused_seconds).toBeGreaterThanOrEqual(afterResume + 29);
  });

  it("refuses commands on a workout that is not in progress or not the athlete's", async () => {
    const session = await startWorkout();
    const setId = session.exercises[0].sets[0].id;
    await api("patch", `/${session.id}`, { status: "completed" });

    const afterFinish = await api("patch", `/${session.id}/sets/${setId}`, { status: "completed" });
    expect(afterFinish.status).toBe(409);
    expect(afterFinish.body.error.code).toBe("E.SESSION.NOT_ACTIVE");

    const other = await startWorkout();
    expect(
      (await api("patch", `/${other.id}/sets/${uuidv4()}`, { status: "skipped" })).status,
    ).toBe(404);

    const stranger = await signInNewAthlete(app, "stranger");
    const foreign = await request(app)
      .post(`/api/v1/sessions/${other.id}/pause`)
      .set("Authorization", stranger.bearer);
    expect(foreign.status).toBe(404);
  });
});
