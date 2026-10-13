import type { Knex } from "knex";

/**
 * Optimistic concurrency token for editable plans.
 * Existing plans begin at revision 1; writes advance it atomically.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("plans", (table) => {
    table.integer("revision").notNullable().defaultTo(1);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("plans", (table) => {
    table.dropColumn("revision");
  });
}
