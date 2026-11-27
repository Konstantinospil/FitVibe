import type { Knex } from "knex";

/**
 * Issue 365, ADR-044: what the athlete says about a workout after doing it, and
 * one optional photo.
 *
 * - `sessions.result_note` is the post-workout note. It is kept apart from
 *   `sessions.notes`, which holds the plan's instructions, so finishing a workout
 *   never overwrites what was planned. A planned session has no result, so it has
 *   no result note; a reopened one keeps it while it is corrected. The length
 *   mirrors SESSION_TEXT_LIMITS.noteMaxLength (1000).
 * - The photo is a `media` row with target_type 'session' and target_id the
 *   session id. A session has at most one; a new upload replaces it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (table) => {
    table.text("result_note").nullable();
  });
  await knex.raw(
    `ALTER TABLE sessions ADD CONSTRAINT sessions_result_note_length
       CHECK (result_note IS NULL OR char_length(result_note) <= 1000)`,
  );
  await knex.raw(
    `ALTER TABLE sessions ADD CONSTRAINT sessions_result_note_not_planned
       CHECK (result_note IS NULL OR status <> 'planned')`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX media_session_photo_unique
       ON media (target_id) WHERE target_type = 'session'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS media_session_photo_unique");
  await knex.raw("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_result_note_not_planned");
  await knex.raw("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_result_note_length");
  await knex.schema.alterTable("sessions", (table) => {
    table.dropColumn("result_note");
  });
}
