import type { Knex } from "knex";

/**
 * #557 Stage B: prior password hashes only. Never store plaintext or fast
 * digests of candidate secrets. The current hash remains in users.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("user_password_history", (table) => {
    table.uuid("id").primary();
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("password_hash").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "created_at"], "password_history_user_created_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("user_password_history");
}
