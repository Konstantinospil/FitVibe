import type { Knex } from "knex";

/**
 * Issue 290, ADR-045: what the athlete drank and ate during a workout.
 *
 * A typed log, one row per entry, so intake can be totalled and audited. It is
 * kept apart from `sessions.calories`, which is the energy the workout used
 * (and feeds points), and from body measurements such as body water.
 *
 * - kind 'water' is an amount in millilitres; kind 'energy' is food energy in
 *   kilocalories. The amount limits mirror INTAKE_LIMITS in sessions.intake.ts.
 * - Entries belong to the session and go with it (account deletion, a discarded
 *   workout).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("session_intake_entries", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("session_id")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.text("kind").notNullable();
    table.integer("amount").notNullable();
    table.timestamp("recorded_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "recorded_at"], "session_intake_entries_session_recorded_idx");
  });
  await knex.raw(
    `ALTER TABLE session_intake_entries ADD CONSTRAINT session_intake_entries_kind_check
       CHECK (kind IN ('water', 'energy'))`,
  );
  await knex.raw(
    `ALTER TABLE session_intake_entries ADD CONSTRAINT session_intake_entries_amount_check
       CHECK ((kind = 'water' AND amount BETWEEN 1 AND 5000)
           OR (kind = 'energy' AND amount BETWEEN 1 AND 5000))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("session_intake_entries");
}
