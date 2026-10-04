import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("points_event_revisions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("points_event_id").notNullable();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onUpdate("CASCADE")
      .onDelete("CASCADE");
    table.string("source_type").notNullable();
    table.uuid("source_id").nullable();
    table.string("algorithm_version").nullable();
    table.integer("points").notNullable();
    table.integer("calories").nullable();
    table.jsonb("metadata").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp("awarded_at", { useTz: true }).notNullable();
    table.string("revision_reason").notNullable();
    table.timestamp("revised_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(["user_id", "revised_at"], "points_event_revisions_user_time_idx");
    table.index(["points_event_id"], "points_event_revisions_event_idx");
  });

  await knex.schema.createTable("user_gamification_projection_state", (table) => {
    table
      .uuid("user_id")
      .primary()
      .references("id")
      .inTable("users")
      .onUpdate("CASCADE")
      .onDelete("CASCADE");
    table.boolean("is_stale").notNullable().defaultTo(true);
    table.boolean("rebuild_required").notNullable().defaultTo(true);
    table.string("algorithm_version").nullable();
    table.timestamp("stale_since", { useTz: true }).nullable();
    table.timestamp("last_rebuilt_at", { useTz: true }).nullable();
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("sessions", (table) => {
    table.boolean("gamification_rebuild_required").notNullable().defaultTo(false);
  });

  await knex.schema.alterTable("vibe_level_changes", (table) => {
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("superseded_at", { useTz: true }).nullable();
  });

  await knex.schema.alterTable("badges", (table) => {
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("superseded_at", { useTz: true }).nullable();
  });

  await knex.raw("ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_user_badge_unique_idx");
  await knex.raw("DROP INDEX IF EXISTS badges_user_badge_unique_idx");
  await knex.raw(`
    CREATE UNIQUE INDEX badges_user_badge_active_unique_idx
    ON badges (user_id, badge_type)
    WHERE is_active = TRUE
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex("badges").where({ is_active: false }).del();

  await knex.schema.alterTable("sessions", (table) => {
    table.dropColumn("gamification_rebuild_required");
  });

  await knex.raw("DROP INDEX IF EXISTS badges_user_badge_active_unique_idx");
  await knex.raw(`
    CREATE UNIQUE INDEX badges_user_badge_unique_idx
    ON badges (user_id, badge_type)
  `);

  await knex.schema.alterTable("badges", (table) => {
    table.dropColumn("superseded_at");
    table.dropColumn("is_active");
  });

  await knex.schema.alterTable("vibe_level_changes", (table) => {
    table.dropColumn("superseded_at");
    table.dropColumn("is_active");
  });

  await knex.schema.dropTableIfExists("user_gamification_projection_state");
  await knex.schema.dropTableIfExists("points_event_revisions");
}
