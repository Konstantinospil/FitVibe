import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("audit_log", (table) => {
    table.string("severity", 16).notNullable().defaultTo("info");
    table.timestamp("resolved_at", { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("audit_log", (table) => {
    table.dropColumn("resolved_at");
    table.dropColumn("severity");
  });
}
