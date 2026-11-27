import { it, expect, beforeAll, beforeEach } from "@jest/globals";
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

type VibeChange = {
  user_id: string;
  session_id: string | null;
  domain_code: string;
  old_vibe_level: number;
  new_vibe_level: number;
  change_amount: number;
  change_reason?: "session_completed" | "decay" | "manual_adjustment";
  is_active?: boolean;
};

/**
 * GET /sessions/:id/vibe-changes (issue 289): the workout result lists the Vibe
 * level changes a session caused, for its owner only.
 */
describeWithTestDatabase("Integration: session Vibe changes", () => {
  let owner: SignedInAthlete;
  let other: SignedInAthlete;

  const createSession = async (athlete: SignedInAthlete) => {
    // A planned session: completing one would queue the real points processing,
    // which writes rows of its own.
    const response = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", athlete.bearer)
      .send({ planned_at: new Date(Date.now() + 86_400_000).toISOString() });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const insertChange = (change: VibeChange) =>
    db("vibe_level_changes").insert({
      old_rd: 300,
      new_rd: 290,
      change_reason: "session_completed",
      is_active: true,
      ...change,
    });

  const vibeChanges = (athlete: SignedInAthlete, sessionId: string) =>
    request(app)
      .get(`/api/v1/sessions/${sessionId}/vibe-changes`)
      .set("Authorization", athlete.bearer);

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    owner = await signInNewAthlete(app, "vibe-owner");
    other = await signInNewAthlete(app, "vibe-other");
  });

  it("lists the active changes this session caused, one per Vibe, in a stable order", async () => {
    const sessionId = await createSession(owner);
    const otherSessionId = await createSession(owner);
    const base = { user_id: owner.userId, session_id: sessionId };
    await insertChange({
      ...base,
      domain_code: "strength",
      old_vibe_level: 1000,
      new_vibe_level: 1012.5,
      change_amount: 12.5,
    });
    await insertChange({
      ...base,
      domain_code: "endurance",
      old_vibe_level: 980,
      new_vibe_level: 984,
      change_amount: 4,
    });
    // Superseded by a rebuild, a decay entry, and another session's change: none belong.
    await insertChange({
      ...base,
      domain_code: "agility",
      old_vibe_level: 1000,
      new_vibe_level: 1050,
      change_amount: 50,
      is_active: false,
    });
    await insertChange({
      ...base,
      domain_code: "regeneration",
      old_vibe_level: 1000,
      new_vibe_level: 999,
      change_amount: -1,
      change_reason: "decay",
    });
    await insertChange({
      user_id: owner.userId,
      session_id: otherSessionId,
      domain_code: "strength",
      old_vibe_level: 1012.5,
      new_vibe_level: 1020,
      change_amount: 7.5,
    });

    const response = await vibeChanges(owner, sessionId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      session_id: sessionId,
      changes: [
        { domain_code: "endurance", previous_level: 980, new_level: 984, change: 4 },
        { domain_code: "strength", previous_level: 1000, new_level: 1012.5, change: 12.5 },
      ],
    });
  });

  it("is empty before the session's points are processed", async () => {
    const sessionId = await createSession(owner);

    const response = await vibeChanges(owner, sessionId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ session_id: sessionId, changes: [] });
  });

  it("answers someone else's session exactly like a missing one", async () => {
    const sessionId = await createSession(owner);
    await insertChange({
      user_id: owner.userId,
      session_id: sessionId,
      domain_code: "strength",
      old_vibe_level: 1000,
      new_vibe_level: 1010,
      change_amount: 10,
    });
    const missingId = "00000000-0000-4000-8000-000000000000";

    const foreign = await vibeChanges(other, sessionId);
    const missing = await vibeChanges(other, missingId);

    // Bodies differ only by the request id.
    const withoutRequestId = (body: { error: Record<string, unknown> }) => {
      const { requestId: _requestId, ...rest } = body.error;
      return rest;
    };
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(withoutRequestId(foreign.body)).toEqual(withoutRequestId(missing.body));
    expect(foreign.body.error.code).toBe("E.SESSION.NOT_FOUND");
  });

  it("does not list a deleted session's changes", async () => {
    const sessionId = await createSession(owner);
    await insertChange({
      user_id: owner.userId,
      session_id: sessionId,
      domain_code: "strength",
      old_vibe_level: 1000,
      new_vibe_level: 1010,
      change_amount: 10,
    });
    expect(
      (
        await request(app)
          .delete(`/api/v1/sessions/${sessionId}`)
          .set("Authorization", owner.bearer)
      ).status,
    ).toBeLessThan(300);

    expect((await vibeChanges(owner, sessionId)).status).toBe(404);
  });

  it("requires a signed-in user", async () => {
    const sessionId = await createSession(owner);

    expect((await request(app).get(`/api/v1/sessions/${sessionId}/vibe-changes`)).status).toBe(401);
  });
});
