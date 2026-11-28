import { it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { collectUserData } from "../../../apps/backend/src/modules/users/users.export.service.js";
import { INTAKE_LIMITS } from "../../../apps/backend/src/modules/sessions/sessions.intake.service.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";

const HOUR_MS = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

/**
 * Workout intake (issue 290, ADR-045): water and food energy as typed entries,
 * apart from the workout's own calories, visible to the owner only.
 */
describeWithTestDatabase("Integration: workout intake", () => {
  let owner: SignedInAthlete;
  let other: SignedInAthlete;

  const createSession = async (body: Record<string, unknown>) => {
    const response = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", owner.bearer)
      .send(body);
    expect(response.status).toBe(201);
    return response.body;
  };
  const record = (athlete: SignedInAthlete, sessionId: string, body: unknown) =>
    request(app)
      .post(`/api/v1/sessions/${sessionId}/intake`)
      .set("Authorization", athlete.bearer)
      .send(body as object);

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    owner = await signInNewAthlete(app, "intake-owner");
    other = await signInNewAthlete(app, "intake-other");
  });

  it("records water and energy during a live workout, apart from its calories", async () => {
    const planned = await createSession({ planned_at: hoursFromNow(-1) });
    const started = await request(app)
      .patch(`/api/v1/sessions/${planned.id}`)
      .set("Authorization", owner.bearer)
      .send({ status: "in_progress" });
    expect(started.status).toBe(200);

    expect((await record(owner, planned.id, { kind: "water", amount: 500 })).status).toBe(201);
    const latest = await record(owner, planned.id, { kind: "energy", amount: 90 });
    expect(latest.status).toBe(201);
    expect(latest.body.totals).toEqual({ water_ml: 500, energy_kcal: 90 });
    expect(latest.body.entries.map((entry: { kind: string }) => entry.kind)).toEqual([
      "water",
      "energy",
    ]);

    const session = await request(app)
      .get(`/api/v1/sessions/${planned.id}`)
      .set("Authorization", owner.bearer);
    expect(session.body.intake.totals).toEqual({ water_ml: 500, energy_kcal: 90 });
    expect(session.body.calories ?? null).toBeNull();
  });

  it("refuses intake before the workout starts and amounts over the limit", async () => {
    const planned = await createSession({ planned_at: hoursFromNow(24) });
    const early = await record(owner, planned.id, { kind: "water", amount: 250 });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("E.SESSION.INTAKE_NOT_STARTED");

    const logged = await createSession({ status: "completed", planned_at: hoursFromNow(-2) });
    const tooMuch = await record(owner, logged.id, {
      kind: "water",
      amount: INTAKE_LIMITS.waterMaxMl + 1,
    });
    expect(tooMuch.status).toBe(400);
    expect((await record(owner, logged.id, { kind: "coffee", amount: 1 })).status).toBe(400);
  });

  it("takes a manual Log's intake in the same request, at the workout's end", async () => {
    const logged = await createSession({
      status: "completed",
      planned_at: hoursFromNow(-3),
      planned_duration_min: 60,
      intake: [
        { kind: "water", amount: 750 },
        { kind: "energy", amount: 200 },
      ],
    });
    expect(logged.intake.totals).toEqual({ water_ml: 750, energy_kcal: 200 });
    for (const entry of logged.intake.entries) {
      expect(entry.recorded_at).toBe(new Date(logged.completed_at).toISOString());
    }

    const refused = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", owner.bearer)
      .send({ planned_at: hoursFromNow(24), intake: [{ kind: "water", amount: 1 }] });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("E.SESSION.INTAKE_WITHOUT_RESULT");
  });

  it("keeps intake private and lets the owner remove an entry", async () => {
    const logged = await createSession({
      status: "completed",
      planned_at: hoursFromNow(-2),
      visibility: "public",
      intake: [{ kind: "water", amount: 400 }],
    });
    const [entry] = logged.intake.entries;

    const seen = await request(app)
      .get(`/api/v1/sessions/${logged.id}`)
      .set("Authorization", other.bearer);
    expect(seen.status).toBe(200);
    expect(seen.body.intake).toBeNull();
    expect((await record(other, logged.id, { kind: "water", amount: 1 })).status).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/sessions/${logged.id}/intake/${entry.id}`)
          .set("Authorization", other.bearer)
      ).status,
    ).toBe(404);

    const removed = await request(app)
      .delete(`/api/v1/sessions/${logged.id}/intake/${entry.id}`)
      .set("Authorization", owner.bearer);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ entries: [], totals: { water_ml: 0, energy_kcal: 0 } });
    expect(
      (
        await request(app)
          .delete(`/api/v1/sessions/${logged.id}/intake/${entry.id}`)
          .set("Authorization", owner.bearer)
      ).status,
    ).toBe(404);
  });

  it("is part of the athlete's data export and goes with the session", async () => {
    const logged = await createSession({
      status: "completed",
      planned_at: hoursFromNow(-2),
      intake: [{ kind: "energy", amount: 120 }],
    });
    const bundle = await collectUserData(owner.userId);
    expect(bundle.sessions.intake).toEqual([
      expect.objectContaining({ session_id: logged.id, kind: "energy", amount: 120 }),
    ]);

    await db("sessions").where({ id: logged.id }).del();
    expect(await db("session_intake_entries").where({ session_id: logged.id })).toHaveLength(0);
  });
});
