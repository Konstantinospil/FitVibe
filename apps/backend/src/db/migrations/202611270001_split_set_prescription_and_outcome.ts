import type { Knex } from "knex";

/**
 * ADR-042: separate a set's prescription from what was performed.
 *
 * Until now the workout editor stored target values in the performed columns of
 * `exercise_sets`, and scoring counted every row, so a planned workout that was
 * marked completed scored its prescription as performed work.
 *
 * - `status`: planned | completed | skipped. Only completed sets are performed work.
 * - `source`: prescribed (part of the plan) | added (added while training).
 * - `planned_*`: the per-set prescription. The existing columns (reps, weight_kg,
 *   distance_m, duration_sec, rpe, rest_sec) hold performed values only.
 * - `sessions.completion_outcome`: completed | stopped_early, set when a session
 *   completes. Status stays `completed` in both cases.
 *
 * Backfill. A set's class comes from its session, never from `recorded_at`
 * alone, because historical writers omitted that timestamp:
 * - sets of completed sessions, of reopened sessions (in progress with a pending
 *   gamification rebuild) and sets with `recorded_at` are completed work. Their
 *   prescription is unknown and stays NULL.
 * - every other set (planned, in-progress or canceled sessions) is prescription:
 *   its values move to `planned_*`, and its performed columns become NULL.
 */

const METRICS = [
  ["reps", "planned_reps"],
  ["weight_kg", "planned_weight_kg"],
  ["distance_m", "planned_distance_m"],
  ["duration_sec", "planned_duration_sec"],
  ["rpe", "planned_rpe"],
  ["rest_sec", "planned_rest_sec"],
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_sets", (table) => {
    table.string("status").notNullable().defaultTo("planned");
    table.string("source").notNullable().defaultTo("prescribed");
    table.integer("planned_reps").nullable();
    table.decimal("planned_weight_kg", 8, 2).nullable();
    table.integer("planned_distance_m").nullable();
    table.integer("planned_duration_sec").nullable();
    table.integer("planned_rpe").nullable();
    table.integer("planned_rest_sec").nullable();
  });
  await knex.raw(
    `ALTER TABLE exercise_sets ADD CONSTRAINT exercise_sets_status_check CHECK (status IN ('planned', 'completed', 'skipped'))`,
  );
  await knex.raw(
    `ALTER TABLE exercise_sets ADD CONSTRAINT exercise_sets_source_check CHECK (source IN ('prescribed', 'added'))`,
  );

  await knex.raw(`
    UPDATE exercise_sets es
    SET status = 'completed'
    FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = es.session_exercise_id
      AND (
        s.status = 'completed'
        OR (s.status = 'in_progress' AND s.gamification_rebuild_required = true)
        OR es.recorded_at IS NOT NULL
      )
  `);

  const moveToPlanned = METRICS.map(([actual, planned]) => `${planned} = ${actual}`).join(", ");
  const clearActual = METRICS.map(([actual]) => `${actual} = NULL`).join(", ");
  await knex.raw(
    `UPDATE exercise_sets SET ${moveToPlanned}, ${clearActual} WHERE status = 'planned'`,
  );

  await knex.schema.alterTable("sessions", (table) => {
    table.string("completion_outcome").nullable();
  });
  await knex.raw(
    `ALTER TABLE sessions ADD CONSTRAINT sessions_completion_outcome_check CHECK (completion_outcome IS NULL OR completion_outcome IN ('completed', 'stopped_early'))`,
  );
  await knex.raw(`UPDATE sessions SET completion_outcome = 'completed' WHERE status = 'completed'`);
}

export async function down(knex: Knex): Promise<void> {
  const restoreActual = METRICS.map(([actual, planned]) => `${actual} = ${planned}`).join(", ");
  await knex.raw(`UPDATE exercise_sets SET ${restoreActual} WHERE status = 'planned'`);

  await knex.raw(
    "ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_completion_outcome_check",
  );
  await knex.schema.alterTable("sessions", (table) => {
    table.dropColumn("completion_outcome");
  });

  await knex.raw("ALTER TABLE exercise_sets DROP CONSTRAINT IF EXISTS exercise_sets_source_check");
  await knex.raw("ALTER TABLE exercise_sets DROP CONSTRAINT IF EXISTS exercise_sets_status_check");
  await knex.schema.alterTable("exercise_sets", (table) => {
    for (const [, planned] of METRICS) {
      table.dropColumn(planned);
    }
    table.dropColumn("source");
    table.dropColumn("status");
  });
}
