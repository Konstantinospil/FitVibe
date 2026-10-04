import type { Knex } from "knex";

/**
 * Phase 12: keep exercise_sets as the sole performed-workout authority while
 * preserving legacy top-level "actual" metadata during the compatibility
 * window. No legacy actual-attributes table is reintroduced.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_sets", (table) => {
    table.integer("rest_sec").nullable();
    table.jsonb("extras").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp("recorded_at", { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_sets", (table) => {
    table.dropColumn("recorded_at");
    table.dropColumn("extras");
    table.dropColumn("rest_sec");
  });
}
