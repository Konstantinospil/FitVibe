import { db } from "../connection.js";
import { logger } from "../../config/logger.js";
import { toErrorPayload } from "../../utils/error.utils.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const TABLES = [
  "roles",
  "genders",
  "fitness_levels",
  "exercise_types",
  "users",
  "profiles",
  "user_contacts",
  "user_tombstones",
  "user_state_history",
  "media",
  "auth_sessions",
  "refresh_tokens",
  "auth_tokens",
  "pending_2fa_sessions",
  "user_2fa_settings",
  "backup_codes",
  "failed_login_attempts",
  "failed_login_attempts_by_ip",
  "exercises",
  "plans",
  "sessions",
  "session_exercises",
  "exercise_sets",
  "planned_exercise_attributes",
  "personal_records",
  "followers",
  "feed_items",
  "feed_comments",
  "feed_likes",
  "session_bookmarks",
  "user_blocks",
  "feed_reports",
  "user_points",
  "badge_catalog",
  "badges",
  "user_domain_vibe_levels",
  "vibe_level_changes",
  "audit_log",
  "cookie_consents",
  "idempotency_keys",
  "blacklist",
  "contact_messages",
  "translations",
  "bio_attributes",
  "bio_attribute_values",
  "bio_attribute_selections",
  "perf_attributes",
  "perf_attribute_values",
  "perf_attribute_selections",
  "user_vibeform_preferences",
];

const VIEWS = ["session_summary", "weekly_aggregates", "mv_leaderboard"];

const REQUIRED_COUNTS = [
  { table: "roles", minCount: 4 },
  { table: "genders", minCount: 4 },
  { table: "fitness_levels", minCount: 5 },
  { table: "exercise_types", minCount: 24 },
  { table: "badge_catalog", minCount: 36 },
  { table: "bio_attributes", minCount: 11 },
  { table: "perf_attributes", minCount: 12 },
  { table: "translations", minCount: 1 },
] as const;

async function countRows(table: string): Promise<number> {
  const row = await db(table).count<{ count: string | number }>("* as count").first();
  return row ? Number(row.count) : 0;
}

async function verify(): Promise<void> {
  try {
    logger.info("Verifying database objects and required seed data...");

    const missingTables: string[] = [];
    for (const table of TABLES) {
      const exists = await db.schema.hasTable(table);
      logger.info(`${table.padEnd(40)} ${exists ? "present" : "missing"}`);
      if (!exists) {
        missingTables.push(table);
      }
    }
    if (missingTables.length > 0) {
      throw new Error(`Missing required database tables: ${missingTables.join(", ")}`);
    }

    const pointsIndex = await db.raw<{ rows: Array<{ indexdef: string }> }>(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'user_points'
        AND indexname = 'user_points_source_unique_idx'
    `);
    const pointsIndexDefinition = pointsIndex.rows[0]?.indexdef ?? "";
    if (!/^CREATE UNIQUE INDEX\s/i.test(pointsIndexDefinition)) {
      throw new Error("user_points_source_unique_idx is missing or is not unique");
    }
    logger.info("user_points_source_unique_idx verified as unique");

    const coreConstraints = await db.raw<{
      rows: Array<{ conname: string; definition: string }>;
    }>(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname IN ('users_status_check', 'plans_status_check')
    `);
    const constraintMap = new Map(coreConstraints.rows.map((row) => [row.conname, row.definition]));
    const usersStatus = constraintMap.get("users_status_check") ?? "";
    const plansStatus = constraintMap.get("plans_status_check") ?? "";
    for (const requiredStatus of [
      "active",
      "pending_verification",
      "pending_deletion",
      "suspended",
      "banned",
      "deleted",
    ]) {
      if (!usersStatus.includes(requiredStatus)) {
        throw new Error(`users_status_check is missing status '${requiredStatus}'`);
      }
    }
    if (!plansStatus.includes("active") || !plansStatus.includes("completed")) {
      throw new Error("plans_status_check does not enforce the canonical plan states");
    }
    logger.info("Core status constraints verified");

    for (const { table, minCount } of REQUIRED_COUNTS) {
      const count = await countRows(table);
      if (count < minCount) {
        throw new Error(`${table} has ${count} rows; expected at least ${minCount}`);
      }
      logger.info(`${table.padEnd(40)} ${count} required rows present`);
    }

    const globalExercises = await db("exercises")
      .whereNull("owner_id")
      .where({ is_public: true })
      .count<{ count: string | number }>("* as count")
      .first();
    const globalExerciseCount = globalExercises ? Number(globalExercises.count) : 0;
    if (globalExerciseCount < 300) {
      throw new Error(
        `Global exercise catalog has ${globalExerciseCount} rows; expected at least 300`,
      );
    }

    const admin = await db("users")
      .where({ id: ADMIN_ID, role_code: "admin", status: "active" })
      .first<{ id: string }>();
    const adminProfile = await db("profiles")
      .where({ user_id: ADMIN_ID, alias: "admin" })
      .first<{ user_id: string }>();
    const adminContact = await db("user_contacts")
      .where({ user_id: ADMIN_ID, type: "email", is_primary: true, is_verified: true })
      .first<{ id: string }>();

    if (!admin || !adminProfile || !adminContact) {
      throw new Error("Bootstrap administrator is missing or incomplete");
    }
    logger.info("Bootstrap administrator verified");

    const missingViews: string[] = [];
    for (const view of VIEWS) {
      const result = await db
        .select("matviewname")
        .from("pg_matviews")
        .where("matviewname", view)
        .union([db.select("viewname as matviewname").from("pg_views").where("viewname", view)]);
      const exists = result.length > 0;
      logger.info(`${view.padEnd(40)} ${exists ? "present" : "missing"}`);
      if (!exists) {
        missingViews.push(view);
      }
    }
    if (missingViews.length > 0) {
      throw new Error(`Missing required database views: ${missingViews.join(", ")}`);
    }

    logger.info("Database integrity verification completed successfully.");
  } finally {
    await db.destroy();
  }
}

verify().catch((error: unknown) => {
  logger.error(toErrorPayload(error), "Integrity verification failed");
  process.exit(1);
});
