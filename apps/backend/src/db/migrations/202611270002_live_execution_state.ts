import type { Knex } from "knex";

/**
 * ADR-043: state for live workout execution (#365), on top of ADR-042.
 *
 * - `sessions.paused_at` / `sessions.paused_seconds`: a pause is a span of
 *   wall-clock time that does not count as active training. Active time is
 *   derived from timestamps (started_at, completed_at, paused_seconds and an
 *   open pause), never from a client-side counter.
 * - `session_exercises.status`: planned | skipped. Whether an exercise is done
 *   is derived from its sets; skipping is an explicit athlete action.
 * - `session_exercises.source`: prescribed | added (added while training).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (table) => {
    table.timestamp("paused_at", { useTz: true }).nullable();
    table.integer("paused_seconds").notNullable().defaultTo(0);
  });
  await knex.raw(
    `ALTER TABLE sessions ADD CONSTRAINT sessions_paused_seconds_non_negative CHECK (paused_seconds >= 0)`,
  );

  await knex.schema.alterTable("session_exercises", (table) => {
    table.string("status").notNullable().defaultTo("planned");
    table.string("source").notNullable().defaultTo("prescribed");
  });
  await knex.raw(
    `ALTER TABLE session_exercises ADD CONSTRAINT session_exercises_status_check CHECK (status IN ('planned', 'skipped'))`,
  );
  await knex.raw(
    `ALTER TABLE session_exercises ADD CONSTRAINT session_exercises_source_check CHECK (source IN ('prescribed', 'added'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE session_exercises DROP CONSTRAINT IF EXISTS session_exercises_source_check",
  );
  await knex.raw(
    "ALTER TABLE session_exercises DROP CONSTRAINT IF EXISTS session_exercises_status_check",
  );
  await knex.schema.alterTable("session_exercises", (table) => {
    table.dropColumn("source");
    table.dropColumn("status");
  });
  await knex.raw(
    "ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_paused_seconds_non_negative",
  );
  await knex.schema.alterTable("sessions", (table) => {
    table.dropColumn("paused_seconds");
    table.dropColumn("paused_at");
  });
}
