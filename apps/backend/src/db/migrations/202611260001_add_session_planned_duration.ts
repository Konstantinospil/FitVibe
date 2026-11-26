import type { Knex } from "knex";

/**
 * Planned length of a session, so the planner can detect overlapping trainings
 * (a session occupies [planned_at, planned_at + planned_duration_min)) and resize
 * sessions in the calendar (US-4.3-AC02/AC03, US-4.4-AC01).
 * Existing sessions start at the default length of 60 minutes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (table) => {
    table.integer("planned_duration_min").notNullable().defaultTo(60);
  });
  await knex.raw(
    `ALTER TABLE sessions ADD CONSTRAINT sessions_planned_duration_range CHECK (planned_duration_min BETWEEN 5 AND 720)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_planned_duration_range");
  await knex.schema.alterTable("sessions", (table) => {
    table.dropColumn("planned_duration_min");
  });
}
