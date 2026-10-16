import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("plans", (table) => {
    table.integer("duration_weeks").nullable();
    table.integer("target_frequency").nullable();
    table.timestamp("activated_at", { useTz: true }).nullable();
    table.string("time_zone").notNullable().defaultTo("UTC");
  });
  await knex.raw(
    `ALTER TABLE plans ADD CONSTRAINT plans_duration_weeks_range CHECK (duration_weeks BETWEEN 1 AND 52)`,
  );
  await knex.raw(
    `ALTER TABLE plans ADD CONSTRAINT plans_target_frequency_range CHECK (target_frequency BETWEEN 1 AND 7)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_duration_weeks_range");
  await knex.raw("ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_target_frequency_range");
  await knex.schema.alterTable("plans", (table) => {
    table.dropColumn("time_zone");
    table.dropColumn("activated_at");
    table.dropColumn("target_frequency");
    table.dropColumn("duration_weeks");
  });
}
