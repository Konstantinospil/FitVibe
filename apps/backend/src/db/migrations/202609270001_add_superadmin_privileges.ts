import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex("roles")
    .insert({
      code: "superadmin",
      description: "Privileged platform administrator with sudo-gated system authority",
    })
    .onConflict("code")
    .ignore();

  await knex.schema.createTable("sudo_grants", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onUpdate("CASCADE")
      .onDelete("CASCADE");
    table.uuid("session_jti").notNullable();
    table.timestamp("issued_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true }).nullable();
    table.string("source", 32).notNullable().defaultTo("password_reauth");
    table.index(["user_id", "expires_at"], "sudo_grants_user_expires_idx");
    table.index(["session_jti", "expires_at"], "sudo_grants_session_expires_idx");
  });

  await knex.raw(`
    ALTER TABLE sudo_grants
    ADD CONSTRAINT sudo_grants_source_check
    CHECK (source IN ('password_reauth'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sudo_grants");
  await knex("roles").where("code", "superadmin").del();
}
