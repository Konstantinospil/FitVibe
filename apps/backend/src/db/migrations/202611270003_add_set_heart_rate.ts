import type { Knex } from "knex";

/**
 * Issue 89: an optional heart rate per set, in beats per minute.
 *
 * It is a result, like reps and load, so it has no `planned_*` twin: a set's
 * prescription never holds a heart rate. Only completed sets carry one. The
 * bounds (20-250 bpm) refuse typing errors, not unusual athletes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_sets", (table) => {
    table.smallint("heart_rate_bpm").nullable();
  });
  await knex.raw(
    `ALTER TABLE exercise_sets ADD CONSTRAINT exercise_sets_heart_rate_bpm_range
       CHECK (heart_rate_bpm IS NULL OR heart_rate_bpm BETWEEN 20 AND 250)`,
  );
  await knex.raw(
    `ALTER TABLE exercise_sets ADD CONSTRAINT exercise_sets_heart_rate_bpm_completed
       CHECK (heart_rate_bpm IS NULL OR status = 'completed')`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE exercise_sets DROP CONSTRAINT IF EXISTS exercise_sets_heart_rate_bpm_completed",
  );
  await knex.raw(
    "ALTER TABLE exercise_sets DROP CONSTRAINT IF EXISTS exercise_sets_heart_rate_bpm_range",
  );
  await knex.schema.alterTable("exercise_sets", (table) => {
    table.dropColumn("heart_rate_bpm");
  });
}
