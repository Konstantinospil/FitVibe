import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("user_2fa_invitations", (table) => {
    table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
    table.timestamp("dismissed_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("user_2fa_invitations");
}
