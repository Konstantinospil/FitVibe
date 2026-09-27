import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("app_setting_revisions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.bigInteger("revision").notNullable().unique();
    table.string("status", 32).notNullable();
    table.text("reason").notNullable();
    table.uuid("created_by").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("committed_at", { useTz: true }).nullable();
  });

  await knex.raw(`
    ALTER TABLE app_setting_revisions
    ADD CONSTRAINT app_setting_revisions_status_check
    CHECK (status IN ('staged', 'committed'))
  `);

  await knex.schema.createTable("app_setting_revision_items", (table) => {
    table
      .uuid("revision_id")
      .notNullable()
      .references("id")
      .inTable("app_setting_revisions")
      .onDelete("CASCADE");
    table.string("setting_key", 128).notNullable();
    table.jsonb("old_value").nullable();
    table.jsonb("new_value").notNullable();
    table.primary(["revision_id", "setting_key"]);
  });

  await knex.schema.createTable("app_settings_state", (table) => {
    table.integer("id").primary();
    table.bigInteger("active_revision").notNullable().defaultTo(0);
    table.bigInteger("loaded_revision").notNullable().defaultTo(0);
    table.boolean("maintenance_enabled").notNullable().defaultTo(false);
    table.text("maintenance_reason").nullable();
    table
      .uuid("maintenance_started_by")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.timestamp("maintenance_started_at", { useTz: true }).nullable();
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex("app_settings_state").insert({
    id: 1,
    active_revision: 0,
    loaded_revision: 0,
    maintenance_enabled: false,
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("app_settings_state");
  await knex.schema.dropTableIfExists("app_setting_revision_items");
  await knex.schema.dropTableIfExists("app_setting_revisions");
}
