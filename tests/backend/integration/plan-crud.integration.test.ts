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

/** US-4.1 plan CRUD against real Postgres. */
describeWithTestDatabase("Integration: plan CRUD (US-4.1)", () => {
  let athlete: SignedInAthlete;

  const createPlan = (body: Record<string, unknown>) =>
    request(app).post("/api/v1/plans").set("Authorization", athlete.bearer).send(body);

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    athlete = await signInNewAthlete(app, "plans");
  });

  it("AC01: creates a plan with name, start and end date within 500 ms", async () => {
    // Warm-up request so module loading and connection setup are not measured.
    expect((await createPlan({ name: "Warm-up" })).status).toBe(201);

    const timings: number[] = [];
    let created: { id: string } | undefined;
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      const response = await createPlan({
        name: `Base block ${index + 1}`,
        start_date: "2026-12-07",
        end_date: "2027-01-03",
      });
      timings.push(performance.now() - started);
      expect(response.status).toBe(201);
      expect(response.headers.etag).toMatch(/^"/);
      created = response.body;
    }

    const slowest = Math.max(...timings);
    console.info(
      `[US-4.1-AC01] plan create timings (ms): ${timings.map((t) => t.toFixed(1)).join(", ")}`,
    );
    expect(slowest).toBeLessThanOrEqual(500);

    const row = await db("plans").where({ id: created?.id }).first();
    expect(row).toMatchObject({ user_id: athlete.userId, name: "Base block 5", archived_at: null });
    expect(new Date(row.start_date).toISOString().slice(0, 10)).toBe("2026-12-07");
    expect(new Date(row.end_date).toISOString().slice(0, 10)).toBe("2027-01-03");
  });

  it("AC02: updates persist and are returned after a reload", async () => {
    const created = await createPlan({ name: "Draft" });

    const updated = await request(app)
      .patch(`/api/v1/plans/${created.body.id}`)
      .set("Authorization", athlete.bearer)
      .send({ name: "Strength block", duration_weeks: 4, target_frequency: 3 });
    expect(updated.status).toBe(200);

    const reloaded = await request(app)
      .get(`/api/v1/plans/${created.body.id}`)
      .set("Authorization", athlete.bearer);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body).toMatchObject({
      name: "Strength block",
      duration_weeks: 4,
      target_frequency: 3,
    });
  });

  it("AC03: deleting archives the plan and keeps its sessions", async () => {
    const plan = (await createPlan({ name: "To archive" })).body as { id: string };
    const session = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", athlete.bearer)
      .send({ plan_id: plan.id, title: "Kept", planned_at: "2026-12-08T07:00:00.000Z" });
    expect(session.status).toBe(201);

    const removed = await request(app)
      .delete(`/api/v1/plans/${plan.id}`)
      .set("Authorization", athlete.bearer);
    expect(removed.status).toBe(204);

    const planRow = await db("plans").where({ id: plan.id }).first();
    expect(planRow.archived_at).not.toBeNull();
    const sessionRow = await db("sessions").where({ id: session.body.id }).first();
    expect(sessionRow).toMatchObject({ plan_id: plan.id, deleted_at: null, status: "planned" });

    const listed = await request(app).get("/api/v1/plans").set("Authorization", athlete.bearer);
    expect(listed.body.plans.map(({ id }: { id: string }) => id)).not.toContain(plan.id);
    const sessionStillReadable = await request(app)
      .get(`/api/v1/sessions/${session.body.id}`)
      .set("Authorization", athlete.bearer);
    expect(sessionStillReadable.status).toBe(200);
  });

  it("AC04: a stale ETag is refused with 412; the current one and no ETag both save", async () => {
    const created = await createPlan({ name: "Shared" });
    const firstEtag = created.headers.etag as string;

    const fresh = await request(app)
      .patch(`/api/v1/plans/${created.body.id}`)
      .set("Authorization", athlete.bearer)
      .set("If-Match", firstEtag)
      .send({ name: "Edited in tab one" });
    expect(fresh.status).toBe(200);
    expect(fresh.headers.etag).not.toBe(firstEtag);

    const stale = await request(app)
      .patch(`/api/v1/plans/${created.body.id}`)
      .set("Authorization", athlete.bearer)
      .set("If-Match", firstEtag)
      .send({ name: "Edited in tab two" });
    expect(stale.status).toBe(412);
    expect(stale.body.error.code).toBe("E.PLAN.STALE_VERSION");
    expect((await db("plans").where({ id: created.body.id }).first()).name).toBe(
      "Edited in tab one",
    );

    const lastWriter = await request(app)
      .patch(`/api/v1/plans/${created.body.id}`)
      .set("Authorization", athlete.bearer)
      .send({ name: "Last writer" });
    expect(lastWriter.status).toBe(200);
    expect(lastWriter.body.name).toBe("Last writer");
  });
});
