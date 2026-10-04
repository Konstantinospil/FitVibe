import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("pending_2fa_sessions", (table) => {
    table.text("identifier").nullable();
    table.integer("failed_attempts").notNullable().defaultTo(0);
    table.timestamp("last_failed_at", { useTz: true }).nullable();
    table.index(["user_id", "ip", "last_failed_at"], "pending_2fa_sessions_throttle_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("pending_2fa_sessions", (table) => {
    table.dropIndex(["user_id", "ip", "last_failed_at"], "pending_2fa_sessions_throttle_idx");
    table.dropColumn("last_failed_at");
    table.dropColumn("failed_attempts");
    table.dropColumn("identifier");
  });
}
