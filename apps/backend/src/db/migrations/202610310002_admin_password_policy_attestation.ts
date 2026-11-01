import type { Knex } from "knex";

/**
 * #557: Password hashes cannot disclose historic plaintext length.
 * Null means the active administrator credential has NOT been proven to have
 * been set under the >=16-character administrator policy. Existing accounts
 * are deliberately not grandfathered in.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.timestamp("admin_password_policy_verified_at", { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("admin_password_policy_verified_at");
  });
}
