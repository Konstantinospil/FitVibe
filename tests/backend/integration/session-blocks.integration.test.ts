import { it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { collectUserData } from "../../../apps/backend/src/modules/users/users.export.service.js";
import { SESSION_BLOCK_LIMITS } from "../../../apps/backend/src/modules/sessions/sessions.blocks.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";

const HOUR_MS = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

const tabata = { ref: 1, kind: "interval", name: "Tabata", rounds: 8, work_sec: 20, rest_sec: 10 };
const circuit = { ref: 2, kind: "circuit", rounds: 3, round_rest_sec: 60 };
const timedRounds = (rounds: number, seconds: number) =>
  Array.from({ length: rounds }, (_, index) => ({
    order: index + 1,
    planned: { duration_sec: seconds },
  }));

/**
 * Interval and circuit blocks (issue 290, ADR-046): a block groups consecutive
 * exercises, each round of a member is one of its sets, and flat sessions are
 * unchanged.
 */
describeWithTestDatabase("Integration: interval and circuit blocks", () => {
  let owner: SignedInAthlete;

  const send = (method: "post" | "patch", path: string, body: Record<string, unknown>) =>
    request(app)[method](`/api/v1${path}`).set("Authorization", owner.bearer).send(body);

  const blockedWorkout = () => ({
    planned_at: hoursFromNow(24),
    exercises: [
      { order: 1, sets: timedRounds(1, 600) },
      { order: 2, block_ref: 1, sets: timedRounds(tabata.rounds, tabata.work_sec) },
      { order: 3, block_ref: 2, sets: [{ order: 1, planned: { reps: 10 } }] },
      { order: 4, block_ref: 2, sets: [{ order: 1, planned: { reps: 15 } }] },
      { order: 5 },
    ],
    blocks: [circuit, tabata],
  });

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    owner = await signInNewAthlete(app, "blocks-owner");
  });

  it("stores blocks with their members and returns them in exercise order", async () => {
    const created = await send("post", "/sessions", blockedWorkout());
    expect(created.status).toBe(201);

    const read = await request(app)
      .get(`/api/v1/sessions/${created.body.id}`)
      .set("Authorization", owner.bearer);
    expect(read.status).toBe(200);
    // The request listed the circuit first; the session orders blocks by their members.
    expect(read.body.blocks).toEqual([
      expect.objectContaining({ kind: "interval", name: "Tabata", rounds: 8, work_sec: 20 }),
      expect.objectContaining({ kind: "circuit", rounds: 3, round_rest_sec: 60, work_sec: null }),
    ]);
    const [interval, rounds] = read.body.blocks;
    expect(read.body.exercises.map((item: { block_id: string | null }) => item.block_id)).toEqual([
      null,
      interval.id,
      rounds.id,
      rounds.id,
      null,
    ]);
    expect(read.body.exercises[1].sets).toHaveLength(tabata.rounds);
  });

  it("leaves a flat session without blocks", async () => {
    const created = await send("post", "/sessions", {
      planned_at: hoursFromNow(24),
      exercises: [{ order: 1 }, { order: 2 }],
    });
    expect(created.status).toBe(201);
    expect(created.body.blocks).toEqual([]);
    expect(
      created.body.exercises.every((item: { block_id: string | null }) => item.block_id === null),
    ).toBe(true);
  });

  it("replaces blocks with the exercises, and refuses blocks on their own", async () => {
    const created = (await send("post", "/sessions", blockedWorkout())).body;

    const blocksOnly = await send("patch", `/sessions/${created.id}`, { blocks: [tabata] });
    expect(blocksOnly.status).toBe(400);
    expect(blocksOnly.body.error.code).toBe("E.SESSION.BLOCKS_WITHOUT_EXERCISES");

    const flattened = await send("patch", `/sessions/${created.id}`, {
      exercises: [{ order: 1 }, { order: 2 }],
    });
    expect(flattened.status).toBe(200);
    expect(flattened.body.blocks).toEqual([]);
    const left = await db("session_blocks").where({ session_id: created.id });
    expect(left).toHaveLength(0);
  });

  it("refuses a structure that does not hold together", async () => {
    const split = await send("post", "/sessions", {
      planned_at: hoursFromNow(24),
      exercises: [{ order: 1, block_ref: 2 }, { order: 2 }, { order: 3, block_ref: 2 }],
      blocks: [circuit],
    });
    expect(split.status).toBe(422);
    expect(split.body.error.code).toBe("E.SESSION.INVALID_BLOCK");

    const tooManyRounds = await send("post", "/sessions", {
      planned_at: hoursFromNow(24),
      exercises: [{ order: 1, block_ref: 1 }],
      blocks: [{ ...tabata, rounds: SESSION_BLOCK_LIMITS.maxRounds + 1 }],
    });
    expect(tooManyRounds.status).toBe(400);
  });

  it("enforces the interval's work time in the database too", async () => {
    const created = (await send("post", "/sessions", blockedWorkout())).body;
    await expect(
      db("session_blocks").insert({ session_id: created.id, kind: "interval", rounds: 4 }),
    ).rejects.toThrow(/session_blocks_values_check/);
  });

  it("copies blocks when the workout is reused", async () => {
    const source = (await send("post", "/sessions", blockedWorkout())).body;
    const copy = await send("post", `/sessions/${source.id}/clone`, {
      planned_at: hoursFromNow(48),
    });
    expect(copy.status).toBe(201);
    expect(copy.body.blocks.map((block: { kind: string }) => block.kind)).toEqual([
      "interval",
      "circuit",
    ]);
    const sourceIds = source.blocks.map((block: { id: string }) => block.id);
    for (const block of copy.body.blocks) {
      expect(sourceIds).not.toContain(block.id);
    }
    expect(copy.body.exercises.map((item: { block_id: string | null }) => item.block_id)).toEqual([
      null,
      copy.body.blocks[0].id,
      copy.body.blocks[1].id,
      copy.body.blocks[1].id,
      null,
    ]);
  });

  it("includes blocks in the athlete's data export", async () => {
    const created = (await send("post", "/sessions", blockedWorkout())).body;
    const bundle = await collectUserData(owner.userId);
    expect(bundle.sessions.blocks).toHaveLength(2);
    expect(bundle.sessions.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ session_id: created.id, kind: "circuit" }),
      ]),
    );
  });
});
