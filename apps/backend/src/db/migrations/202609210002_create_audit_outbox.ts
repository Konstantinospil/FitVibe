import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("audit_outbox", (table) => {
    table.uuid("id").primary();
    table.jsonb("payload").notNullable();
    table.text("last_error").nullable();
    table.integer("attempt_count").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.alterTable("audit_outbox", (table) => {
    table.index(["created_at"], "idx_audit_outbox_created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_outbox");
}
