import type { Knex } from "knex";

/**
 * Email-first registration (ADR-039).
 *
 * Every POST /auth/register records one row here, whether or not the address
 * already has an account, so the per-address throttle counts all addresses
 * alike. Only rows for a brand-new address carry the address itself and the
 * hash of the one-time link that lets its owner finish creating the account.
 * Rows are short-lived and removed by the retention sweep once expired.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("registration_intents", (table) => {
    table.uuid("id").primary();
    // SHA-256 of the normalized address; used for throttling only.
    table.string("email_hash", 64).notNullable();
    // Set only when a continue-registration link was issued for a new address.
    table.string("email", 254).nullable();
    table.string("token_hash", 64).nullable().unique();
    table.string("locale", 16).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("consumed_at", { useTz: true }).nullable();
    table.index(["email_hash", "created_at"], "registration_intents_email_created_idx");
    table.index(["expires_at"], "registration_intents_expires_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("registration_intents");
}
