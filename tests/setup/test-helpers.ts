import type { Knex } from "knex";

// Lazy import to avoid database connection during module load
// This prevents issues when test-helpers.ts is parsed but not used (e.g., in unit tests)
let dbInstance: Knex | null = null;

async function getDb(): Promise<Knex> {
  if (!dbInstance) {
    const dbModule = await import("../../apps/backend/src/db/index.js");
    dbInstance = dbModule.default;
  }
  return dbInstance;
}

export function createTestId(prefix: string = "test"): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

/**
 * RFC1918 IPv4 unique to this call. Integration tests share one database, so
 * brute-force counters keyed by IP must not reuse a hardcoded address.
 */
export function createTestIp(): string {
  const octet = (): number => Math.floor(Math.random() * 256);
  const last = 1 + Math.floor(Math.random() * 254);
  return `10.${octet()}.${octet()}.${last}`;
}

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function within a database transaction that will be rolled back.
 * Useful for integration tests to ensure test data is cleaned up.
 */
export async function withTransaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  return await db.transaction(async (trx) => {
    try {
      const result = await callback(trx);
      // Rollback the transaction to clean up test data
      await trx.rollback();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  });
}

/**
 * Ensure roles are seeded in the database.
 * This is needed for integration tests that create users with role_code.
 * Uses onConflict to safely handle cases where roles already exist.
 */
export async function ensureRolesSeeded(): Promise<void> {
  const db = await getDb();
  const ROLES = [
    { code: "admin", description: "Keeps the map: platform steward for the six stories" },
    {
      code: "coach",
      description: "Mentor for a chapter, with the athlete's consent — then you leave",
    },
    { code: "athlete", description: "The one who must live all six elemental stories" },
    { code: "support", description: "Mends the hero: nutrition, physio, and care between quests" },
  ];

  try {
    await db("roles").insert(ROLES).onConflict("code").ignore();
  } catch (error) {
    // Silently skip if roles table doesn't exist (migrations haven't run)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Ensure the weight_kg bio attribute exists.
 * Profile weight updates write to bio_attribute_values and need this catalog row.
 */
export async function ensureWeightAttributeSeeded(): Promise<void> {
  const db = await getDb();
  try {
    await db("bio_attributes")
      .insert({
        key: "weight_kg",
        normalized_key: "weight",
        label: "Weight",
        unit_type: "weight",
        granularity: "kg",
        measurement_system: "metric",
        min_value_metric: 20,
        max_value_metric: 400,
        min_value_imperial: 44.09,
        max_value_imperial: 881.85,
        is_default: true,
      })
      .onConflict("normalized_key")
      .ignore();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
      return;
    }
    throw error;
  }
}

/**
 * Ensure fitness_levels are seeded in the database.
 * This is needed for integration tests that update user fitness levels.
 * Uses onConflict to safely handle cases where fitness_levels already exist.
 */
export async function ensureFitnessLevelsSeeded(): Promise<void> {
  const db = await getDb();
  const FITNESS_LEVELS = [
    { code: "beginner", description: "Getting started with consistent training" },
    { code: "intermediate", description: "Trains 3-4 times per week" },
    { code: "advanced", description: "Highly trained athlete" },
    { code: "elite", description: "Lives every story at a high level" },
    { code: "rehab", description: "Returning from injury / rehab focus" },
  ];

  try {
    await db("fitness_levels").insert(FITNESS_LEVELS).onConflict("code").ignore();
  } catch (error) {
    // Silently skip if fitness_levels table doesn't exist (migrations haven't run)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Wraps an async function with better error handling for database connection issues.
 * Provides clearer error messages when database connection fails.
 */
export async function withDatabaseErrorHandling<T>(
  fn: () => Promise<T>,
  context: string = "operation",
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Re-throw with more context for debugging
    let errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Handle AggregateError - check for ECONNREFUSED which indicates database connection issue
    if (error instanceof AggregateError) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === "ECONNREFUSED") {
        errorMessage = `Database connection refused (ECONNREFUSED). Ensure PostgreSQL is running and accessible. Check PGHOST, PGPORT, PGUSER, PGPASSWORD, and PGDATABASE environment variables.`;
      } else {
        // Handle other AggregateError cases
        const errorDetails: string[] = [];
        errorDetails.push(`AggregateError: ${error.message || "no message"}`);
        if (errorCode) {
          errorDetails.push(`Error code: ${errorCode}`);
        }
        if (error.errors && error.errors.length > 0) {
          errorDetails.push(`Contains ${error.errors.length} error(s):`);
          error.errors.forEach((e, i) => {
            const msg = e instanceof Error ? e.message : String(e);
            const code = (e as { code?: string }).code;
            errorDetails.push(`  Error ${i + 1}: ${msg}${code ? ` (code: ${code})` : ""}`);
          });
        }
        errorMessage = errorDetails.join("\n");
      }
    } else if ((error as { code?: string }).code === "ECONNREFUSED") {
      errorMessage = `Database connection refused (ECONNREFUSED). Ensure PostgreSQL is running and accessible.`;
    }

    throw new Error(
      `${context} failed: ${errorMessage}${errorStack ? `\nStack: ${errorStack}` : ""}`,
    );
  }
}

/**
 * Check if the database is available for integration tests.
 * Returns true if database connection can be established, false otherwise.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.raw("SELECT 1");
    return true;
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Connection refused - database not available
    if (errorCode === "ECONNREFUSED" || error instanceof AggregateError) {
      return false;
    }

    // Authentication errors - database not accessible with current credentials
    // PostgreSQL error code 28P01 = invalid_password
    if (
      errorCode === "28P01" ||
      errorMessage.includes("password authentication failed") ||
      errorMessage.includes("authentication failed")
    ) {
      return false;
    }

    // For other errors, assume database is available but there might be other issues
    // (e.g., migrations not run, permissions, etc.)
    return true;
  }
}


/**
 * Ensure integration tests have one effective persisted Terms publication.
 * This models the Phase 17 runtime authority without falling back to users.terms_version.
 */
export async function ensureLegalPublicationsSeeded(): Promise<void> {
  const db = await getDb();
  try {
    const existing = await db("legal_document_versions")
      .where({ document_type: "terms" })
      .where("effective_at", "<=", new Date().toISOString())
      .first("id");
    if (existing) {
      return;
    }
    await db("legal_document_versions").insert({
      document_type: "terms",
      version: "test-baseline.1",
      change_class: "legacy",
      user_action: "none",
      effective_at: new Date(Date.now() - 60_000).toISOString(),
      published_at: new Date(Date.now() - 60_000).toISOString(),
      published_by: null,
      source: "test_fixture",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
      return;
    }
    throw error;
  }
}

/**
 * Handle lives on profiles.alias; users.username was removed.
 * Kept so existing test hooks do not need a mass rename.
 */
export async function ensureUsernameColumnExists(): Promise<void> {
  return;
}

/**
 * Truncate all tables in the test database.
 * Use with caution - only in test environments.
 * Silently skips tables that don't exist (e.g., if migrations haven't run yet).
 * Note: Does NOT truncate roles table - roles are needed for foreign key constraints.
 * Ensures roles are seeded after truncation.
 */
export async function truncateAll(): Promise<void> {
  const db = await getDb();
  const tables = [
    "audit_outbox",
    "idempotency_keys",
    "audit_log",
    "cookie_consents",
    "feed_reports",
    "feed_comments",
    "feed_likes",
    "feed_items",
    "session_bookmarks",
    "user_blocks",
    "followers",
    "badges",
    "badge_catalog",
    "user_points",
    "user_domain_vibe_levels",
    "vibe_level_changes",
    "exercise_sets",
    "planned_exercise_attributes",
    "personal_records",
    "session_exercises",
    "sessions",
    "plans",
    "exercises",
    "exercise_types",
    "bio_attribute_values",
    "bio_attribute_selections",
    "perf_attribute_values",
    "perf_attribute_selections",
    "user_state_history",
    "auth_sessions",
    "refresh_tokens",
    "auth_tokens",
    "pending_2fa_sessions",
    "backup_codes",
    "user_2fa_settings",
    "user_contacts",
    "profiles",
    "users",
    "failed_login_attempts",
    "failed_login_attempts_by_ip",
  ];

  // Disable triggers temporarily so TRUNCATE CASCADE doesn't fire audit/other triggers.
  // Requires superuser or REPLICATION role; if not allowed, we continue without it.
  try {
    await db.raw("SET session_replication_role = 'replica'");
  } catch {
    // Permission denied (e.g. non-superuser local DB) – proceed without disabling triggers
  }
  for (const table of tables) {
    try {
      await db.raw(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Silently skip tables that don't exist (e.g., if migrations haven't run)
      // This allows tests to run even if some tables haven't been created yet
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
        // Table doesn't exist, skip it
        continue;
      }
      // Re-throw other errors (permissions, etc.)
      throw error;
    }
  }
  try {
    await db.raw("SET session_replication_role = 'origin'");
  } catch {
    // Ignore if we never set replica (or permission denied)
  }

  // Ensure lookup catalogs are seeded after truncation (these tables are not truncated)
  await ensureRolesSeeded();
  await ensureFitnessLevelsSeeded();
  await ensureWeightAttributeSeeded();
  await ensureLegalPublicationsSeeded();
}
