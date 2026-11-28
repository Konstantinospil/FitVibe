import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";
import openApiSpec from "../../../apps/backend/openapi/openapi.json";

const documented = (name: string) => (openApiSpec as any).components.schemas[name];

/** The documented properties and required fields of a schema match a real response body. */
const expectDocumentedShape = (body: Record<string, unknown>, schema: any) => {
  expect(Object.keys(body).filter((key) => !(key in schema.properties))).toEqual([]);
  for (const key of schema.required ?? []) {
    expect(body).toHaveProperty(key);
  }
};

/**
 * Overlap-based schedule conflicts against real Postgres (US-4.3-AC03, US-4.5-AC02):
 * a session occupies [planned_at, planned_at + planned_duration_min).
 */
describeWithTestDatabase("Integration: session scheduling conflicts", () => {
  let athlete: SignedInAthlete;

  const create = async (planned_at: string, planned_duration_min?: number, title = "Session") => {
    const response = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", athlete.bearer)
      .send({ title, planned_at, ...(planned_duration_min ? { planned_duration_min } : {}) });
    expect(response.status).toBe(201);
    return response.body as { id: string; planned_at: string; planned_duration_min: number };
  };

  const patch = (id: string, body: Record<string, unknown>) =>
    request(app).patch(`/api/v1/sessions/${id}`).set("Authorization", athlete.bearer).send(body);

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    athlete = await signInNewAthlete(app, "sched");
  });

  it("stores the planned length, defaulting to 60 minutes", async () => {
    const defaulted = await create("2026-12-01T08:00:00.000Z");
    const explicit = await create("2026-12-02T08:00:00.000Z", 45);

    expect(defaulted.planned_duration_min).toBe(60);
    expect(explicit.planned_duration_min).toBe(45);
    const row = await db("sessions").where({ id: explicit.id }).first();
    expect(row.planned_duration_min).toBe(45);
  });

  it("rejects lengths outside 5–720 minutes", async () => {
    const session = await create("2026-12-01T08:00:00.000Z");
    for (const planned_duration_min of [4, 721, 30.5]) {
      const response = await patch(session.id, { planned_duration_min });
      expect(response.status).toBe(400);
    }
  });

  it("refuses a move into another session's time and names the blocking session", async () => {
    const morning = await create("2026-12-01T08:00:00.000Z", 60, "Morning");
    const later = await create("2026-12-01T10:00:00.000Z", 60, "Later");

    const response = await patch(later.id, { planned_at: "2026-12-01T08:30:00.000Z" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("E.SESSION.SCHEDULE_CONFLICT");
    expect(response.body.error.details.conflictingSessionIds).toEqual([morning.id]);
    // The body matches the OpenAPI ScheduleConflictResponse (#673).
    const conflictSchema = documented("ScheduleConflictResponse").properties.error;
    expectDocumentedShape(response.body, documented("ScheduleConflictResponse"));
    expectDocumentedShape(response.body.error, conflictSchema);
    expect(conflictSchema.properties.code.enum).toContain(response.body.error.code);
    const row = await db("sessions").where({ id: later.id }).first();
    expect(new Date(row.planned_at).toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("refuses a move that would swallow a shorter session", async () => {
    const short = await create("2026-12-01T09:15:00.000Z", 15);
    const long = await create("2026-12-01T12:00:00.000Z", 120);

    const response = await patch(long.id, { planned_at: "2026-12-01T08:30:00.000Z" });

    expect(response.status).toBe(422);
    expect(response.body.error.details.conflictingSessionIds).toEqual([short.id]);
  });

  it("allows back-to-back sessions", async () => {
    await create("2026-12-01T08:00:00.000Z", 60);
    const later = await create("2026-12-01T10:00:00.000Z", 60);

    const response = await patch(later.id, { planned_at: "2026-12-01T09:00:00.000Z" });

    expect(response.status).toBe(200);
    expect(response.body.planned_at).toBe("2026-12-01T09:00:00.000Z");
    // The body matches the OpenAPI SessionWithExercises (#673).
    expectDocumentedShape(response.body, documented("SessionWithExercises"));
  });

  it("refuses a resize that runs into the next session and saves one that fits", async () => {
    const first = await create("2026-12-01T08:00:00.000Z", 60);
    const next = await create("2026-12-01T09:30:00.000Z", 60);

    const tooLong = await patch(first.id, { planned_duration_min: 91 });
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.error.details.conflictingSessionIds).toEqual([next.id]);

    const fits = await patch(first.id, { planned_duration_min: 90 });
    expect(fits.status).toBe(200);
    expect(fits.body.planned_duration_min).toBe(90);
  });

  it("checks a combined move and resize as one interval", async () => {
    await create("2026-12-01T12:00:00.000Z", 60);
    const moving = await create("2026-12-01T08:00:00.000Z", 30);

    const response = await patch(moving.id, {
      planned_at: "2026-12-01T11:00:00.000Z",
      planned_duration_min: 75,
    });

    expect(response.status).toBe(422);
  });

  it("ignores canceled sessions and other users' sessions", async () => {
    const canceled = await create("2026-12-01T08:00:00.000Z", 60);
    expect((await patch(canceled.id, { status: "canceled" })).status).toBe(200);

    const otherAthlete = await signInNewAthlete(app, "other");
    const foreign = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", otherAthlete.bearer)
      .send({ title: "Theirs", planned_at: "2026-12-01T08:00:00.000Z" });
    expect(foreign.status).toBe(201);

    const moving = await create("2026-12-01T14:00:00.000Z", 60);
    const response = await patch(moving.id, { planned_at: "2026-12-01T08:15:00.000Z" });

    expect(response.status).toBe(200);
  });
});
