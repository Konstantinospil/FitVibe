import { it, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import db from "../../../apps/backend/src/db/index.js";
import {
  down,
  up,
} from "../../../apps/backend/src/db/migrations/202611270001_split_set_prescription_and_outcome.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";

/**
 * ADR-042 backfill (202611270001): a set's class comes from its session.
 * Completed and reopened sessions keep performed values; every other set's
 * values move to its prescription.
 *
 * The migration's down and up run inside one transaction that is always rolled
 * back (PostgreSQL DDL is transactional), so the shared test database is
 * unchanged afterwards.
 */
describeWithTestDatabase("Integration: set prescription backfill (migration 202611270001)", () => {
  const inRolledBackTransaction = async (body: (trx: Knex.Transaction) => Promise<void>) => {
    const trx = await db.transaction();
    try {
      await body(trx);
    } finally {
      await trx.rollback();
    }
  };

  const seedSet = async (
    trx: Knex.Transaction,
    userId: string,
    session: Record<string, unknown>,
    set: Record<string, unknown> = {},
  ) => {
    const sessionId = randomUUID();
    const exerciseRowId = randomUUID();
    const setId = randomUUID();
    await trx("sessions").insert({
      id: sessionId,
      owner_id: userId,
      planned_at: new Date().toISOString(),
      ...session,
    });
    await trx("session_exercises").insert({
      id: exerciseRowId,
      session_id: sessionId,
      order_index: 1,
    });
    await trx("exercise_sets").insert({
      id: setId,
      session_exercise_id: exerciseRowId,
      order_index: 1,
      reps: 5,
      weight_kg: 100,
      rest_sec: 90,
      ...set,
    });
    return { sessionId, setId };
  };

  const withPreMigrationData = (
    body: (
      trx: Knex.Transaction,
      ids: Record<string, { sessionId: string; setId: string }>,
    ) => Promise<void>,
  ) =>
    inRolledBackTransaction(async (trx) => {
      await down(trx);
      const role = (await trx("roles").first("code"))?.code ?? "athlete";
      if (!(await trx("roles").where({ code: role }).first())) {
        await trx("roles").insert({ code: role, description: role });
      }
      const userId = randomUUID();
      await trx("users").insert({
        id: userId,
        display_name: "Backfill",
        role_code: role,
        password_hash: "x",
      });
      const now = new Date().toISOString();
      const ids = {
        completed: await seedSet(trx, userId, { status: "completed", completed_at: now }),
        planned: await seedSet(trx, userId, { status: "planned" }),
        reopened: await seedSet(trx, userId, {
          status: "in_progress",
          gamification_rebuild_required: true,
        }),
        recorded: await seedSet(trx, userId, { status: "in_progress" }, { recorded_at: now }),
        canceled: await seedSet(trx, userId, { status: "canceled" }),
      };
      await body(trx, ids);
    });

  it("classifies sets by their session and moves prescriptions to planned_*", async () => {
    await withPreMigrationData(async (trx, ids) => {
      await up(trx);

      const set = (id: string) =>
        trx("exercise_sets")
          .where({ id })
          .first(
            "status",
            "source",
            "reps",
            "rest_sec",
            "planned_reps",
            "planned_weight_kg",
            "planned_rest_sec",
          );
      const performed = {
        status: "completed",
        source: "prescribed",
        reps: 5,
        rest_sec: 90,
        planned_reps: null,
      };
      const prescription = {
        status: "planned",
        source: "prescribed",
        reps: null,
        rest_sec: null,
        planned_reps: 5,
        planned_rest_sec: 90,
      };

      expect(await set(ids.completed.setId)).toMatchObject(performed);
      expect(await set(ids.reopened.setId)).toMatchObject(performed);
      expect(await set(ids.recorded.setId)).toMatchObject(performed);
      expect(await set(ids.planned.setId)).toMatchObject(prescription);
      expect(await set(ids.canceled.setId)).toMatchObject(prescription);
      expect(Number((await set(ids.planned.setId)).planned_weight_kg)).toBe(100);

      const outcome = async (id: string) =>
        (await trx("sessions").where({ id }).first("completion_outcome")).completion_outcome;
      expect(await outcome(ids.completed.sessionId)).toBe("completed");
      expect(await outcome(ids.planned.sessionId)).toBeNull();
    });
  });

  it("restores prescriptions to the set columns when rolled back", async () => {
    await withPreMigrationData(async (trx, ids) => {
      await up(trx);
      await down(trx);

      const rows = await trx("exercise_sets")
        .whereIn(
          "id",
          Object.values(ids).map((entry) => entry.setId),
        )
        .select("reps", "rest_sec");
      expect(rows).toHaveLength(5);
      expect(rows.every((row) => row.reps === 5 && row.rest_sec === 90)).toBe(true);
    });
  });
});
