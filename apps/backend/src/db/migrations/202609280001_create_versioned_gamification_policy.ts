import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("gamification_policy_versions", (table) => {
    table.string("version_code", 32).primary();
    table.timestamp("valid_from", { useTz: true }).notNullable();
    table.timestamp("valid_to", { useTz: true }).nullable();
    table.integer("streak_lookback_days").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("gamification_streak_tiers", (table) => {
    table
      .string("policy_version", 32)
      .notNullable()
      .references("version_code")
      .inTable("gamification_policy_versions")
      .onDelete("RESTRICT");
    table.integer("min_days").notNullable();
    table.integer("bonus_points").notNullable();
    table.primary(["policy_version", "min_days"]);
  });

  await knex.schema.createTable("gamification_seasonal_events", (table) => {
    table
      .string("policy_version", 32)
      .notNullable()
      .references("version_code")
      .inTable("gamification_policy_versions")
      .onDelete("RESTRICT");
    table.string("code", 64).notNullable();
    table.string("name", 160).notNullable();
    table.timestamp("start_at", { useTz: true }).notNullable();
    table.timestamp("end_at", { useTz: true }).notNullable();
    table.decimal("multiplier", 6, 3).notNullable();
    table.integer("min_sessions_for_bonus").notNullable();
    table.integer("bonus_points").notNullable();
    table.primary(["policy_version", "code"]);
    table.index(["start_at", "end_at"], "gamification_seasonal_events_window_idx");
  });

  await knex("gamification_policy_versions").insert({
    version_code: "v1",
    valid_from: new Date("1970-01-01T00:00:00.000Z"),
    valid_to: null,
    streak_lookback_days: 90,
  });

  await knex("gamification_streak_tiers").insert([
    { policy_version: "v1", min_days: 3, bonus_points: 5 },
    { policy_version: "v1", min_days: 7, bonus_points: 10 },
    { policy_version: "v1", min_days: 14, bonus_points: 20 },
    { policy_version: "v1", min_days: 30, bonus_points: 50 },
  ]);

  await knex("gamification_seasonal_events").insert([
    {
      policy_version: "v1",
      code: "new_year_2025",
      name: "New Year Kickstart 2025",
      start_at: new Date("2025-01-01T00:00:00.000Z"),
      end_at: new Date("2025-01-31T23:59:59.000Z"),
      multiplier: 1.5,
      min_sessions_for_bonus: 12,
      bonus_points: 100,
    },
    {
      policy_version: "v1",
      code: "summer_shred_2025",
      name: "Summer Shred 2025",
      start_at: new Date("2025-06-01T00:00:00.000Z"),
      end_at: new Date("2025-08-31T23:59:59.000Z"),
      multiplier: 1.25,
      min_sessions_for_bonus: 36,
      bonus_points: 250,
    },
    {
      policy_version: "v1",
      code: "holiday_hustle_2025",
      name: "Holiday Hustle 2025",
      start_at: new Date("2025-11-15T00:00:00.000Z"),
      end_at: new Date("2025-12-31T23:59:59.000Z"),
      multiplier: 2,
      min_sessions_for_bonus: 20,
      bonus_points: 200,
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("gamification_seasonal_events");
  await knex.schema.dropTableIfExists("gamification_streak_tiers");
  await knex.schema.dropTableIfExists("gamification_policy_versions");
}
