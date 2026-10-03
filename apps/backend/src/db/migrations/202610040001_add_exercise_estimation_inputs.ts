import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercises", (table) => {
    table.decimal("met_value", 5, 2).nullable();
    table.decimal("seconds_per_rep", 6, 2).nullable();
  });

  await knex.raw(`
    ALTER TABLE exercises
    ADD CONSTRAINT exercises_met_value_check
    CHECK (met_value IS NULL OR (met_value >= 0.1 AND met_value <= 30))
  `);

  await knex.raw(`
    ALTER TABLE exercises
    ADD CONSTRAINT exercises_seconds_per_rep_check
    CHECK (seconds_per_rep IS NULL OR (seconds_per_rep >= 0.1 AND seconds_per_rep <= 120))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercises", (table) => {
    table.dropColumn("seconds_per_rep");
    table.dropColumn("met_value");
  });
}
