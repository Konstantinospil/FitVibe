import path from "node:path";
import fs from "node:fs";
import knex from "knex";
import {
  describeWithTestDatabase,
  testDatabaseConnectionString as DATABASE_URL,
} from "../../setup/db-availability.js";

// Find project root by looking for package.json or going up from test location
function findProjectRoot(): string {
  let current = __dirname;
  while (current !== path.dirname(current)) {
    const packageJson = path.join(current, "package.json");
    try {
      if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, "utf8"));
        if (pkg.name === "fitvibe") {
          return current;
        }
      }
    } catch {
      // Continue searching
    }
    current = path.dirname(current);
  }
  // Fallback: assume we're in tests/backend/migrations, go up 3 levels
  return path.resolve(__dirname, "../../..");
}

const FINAL_SCHEMA = "tmp_migration_schema_test";
const ROLLBACK_SCHEMA = "tmp_migration_rollback_test";
const MIGRATIONS_DIRECTORY = path.resolve(findProjectRoot(), "apps/backend/src/db/migrations");

function createMigrationClient(schemaName: string): knex.Knex {
  return knex({
    client: "pg",
    connection: DATABASE_URL,
    // Keep public available only for extension-provided types/functions. Migration
    // bookkeeping is explicitly pinned to schemaName below.
    searchPath: [schemaName, "public"],
    migrations: {
      loadExtensions: [".ts"],
      directory: MIGRATIONS_DIRECTORY,
      schemaName,
    },
  });
}

async function resetSchema(admin: knex.Knex, schemaName: string): Promise<void> {
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Unsafe test schema name: ${schemaName}`);
  }
  await admin.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  await admin.raw(`CREATE SCHEMA "${schemaName}";`);
}

async function schemaHasTable(
  client: knex.Knex,
  schemaName: string,
  tableName: string,
): Promise<boolean> {
  const row = await client("information_schema.tables")
    .select("table_name")
    .where({ table_schema: schemaName, table_name: tableName })
    .first();
  return Boolean(row);
}

async function schemaColumnInfo(
  client: knex.Knex,
  schemaName: string,
  tableName: string,
): Promise<Record<string, { defaultValue: string | null }>> {
  const rows = (await client("information_schema.columns")
    .select("column_name", "column_default")
    .where({ table_schema: schemaName, table_name: tableName })) as Array<{
    column_name: string;
    column_default: string | null;
  }>;

  return Object.fromEntries(
    rows.map((row) => [row.column_name, { defaultValue: row.column_default }]),
  );
}

describeWithTestDatabase("database migrations", () => {
  let client: knex.Knex;
  let rollbackCycleCompleted = false;

  beforeAll(async () => {
    const admin = knex({
      client: "pg",
      connection: DATABASE_URL,
    });
    let rollbackClient: knex.Knex | undefined;

    try {
      await ensureDatabaseExtensions(admin);

      // Exercise rollback in a disposable schema. Some historical down migrations
      // remove database-wide extensions, so finish this cycle before constructing
      // the authoritative final-schema fixture.
      await resetSchema(admin, ROLLBACK_SCHEMA);
      rollbackClient = createMigrationClient(ROLLBACK_SCHEMA);
      await rollbackClient.migrate.latest();
      await rollbackClient.migrate.rollback(undefined, true);
      rollbackCycleCompleted = true;
      await rollbackClient.destroy();
      rollbackClient = undefined;
      await admin.raw(`DROP SCHEMA IF EXISTS "${ROLLBACK_SCHEMA}" CASCADE;`);

      // Rollback may have removed extensions globally. Restore them, then migrate
      // exactly once into a fresh schema used only for final-state assertions.
      await ensureDatabaseExtensions(admin);
      await resetSchema(admin, FINAL_SCHEMA);
      client = createMigrationClient(FINAL_SCHEMA);
      await client.migrate.latest();
    } finally {
      if (rollbackClient) {
        await rollbackClient.destroy();
      }
      await admin.destroy();
    }
  }, 120000);

  afterAll(async () => {
    if (client) {
      await client.destroy();
    }
    const admin = knex({
      client: "pg",
      connection: DATABASE_URL,
    });
    try {
      await admin.raw(`DROP SCHEMA IF EXISTS "${FINAL_SCHEMA}" CASCADE;`);
      await admin.raw(`DROP SCHEMA IF EXISTS "${ROLLBACK_SCHEMA}" CASCADE;`);
    } finally {
      await admin.destroy();
    }
  });

  it("applies latest migrations and rolls back cleanly in an isolated schema", () => {
    expect(rollbackCycleCompleted).toBe(true);
  });

  describe("table schemas after a single fresh migration", () => {

    it("creates roles table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "roles");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "roles");
      expect(columns.code).toBeDefined();
      expect(columns.description).toBeDefined();
      expect(columns.created_at).toBeDefined();
    });

    it("creates genders table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "genders");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "genders");
      expect(columns.code).toBeDefined();
      expect(columns.description).toBeDefined();
      expect(columns.created_at).toBeDefined();
    });

    it("creates fitness_levels table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "fitness_levels");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "fitness_levels");
      expect(columns.code).toBeDefined();
      expect(columns.description).toBeDefined();
      expect(columns.created_at).toBeDefined();
    });

    it("creates exercise_types table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "exercise_types");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "exercise_types");
      expect(columns.code).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.description).toBeDefined();
      expect(columns.is_active).toBeDefined();
      expect(columns.is_active.defaultValue).toContain("true");
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates users table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "users");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "users");
      expect(columns.id).toBeDefined();
      expect(columns.username).toBeUndefined();
      expect(columns.display_name).toBeDefined();
      expect(columns.password_hash).toBeDefined();
      expect(columns.role_code).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates profiles table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "profiles");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "profiles");
      expect(columns.user_id).toBeDefined();
      expect(columns.date_of_birth).toBeDefined();
      expect(columns.gender_code).toBeDefined();
      expect(columns.alias).toBeDefined();
      expect(columns.alias_changed_at).toBeDefined();
      expect(columns.bio).toBeDefined();
      expect(columns.visibility).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates user_vibeform_preferences with only durable user choices", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "user_vibeform_preferences");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "user_vibeform_preferences");
      expect(Object.keys(columns).sort()).toEqual(
        [
          "body_profile",
          "created_at",
          "motion_enabled",
          "template_code",
          "template_version",
          "updated_at",
          "user_id",
        ].sort(),
      );
      expect(columns.template_code.defaultValue).toContain("flow");
      expect(columns.template_version.defaultValue).toContain("1");
      expect(columns.body_profile.defaultValue).toContain("balanced");
      expect(columns.motion_enabled.defaultValue).toContain("true");
    });

    it("links one vibeform preference record to each user", async () => {
      const constraints = await client.raw(`
        SELECT tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = '${FINAL_SCHEMA}'
          AND tc.table_name = 'user_vibeform_preferences'
      `);

      expect(constraints.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ constraint_type: "PRIMARY KEY", column_name: "user_id" }),
          expect.objectContaining({
            constraint_type: "FOREIGN KEY",
            column_name: "user_id",
            foreign_table_name: "users",
          }),
        ]),
      );
    });

    it("enforces Vibeform cascade deletion and supported body profiles", async () => {
      const foreignKey = await client.raw(`
        SELECT rc.delete_rule
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = '${FINAL_SCHEMA}'
          AND rc.constraint_name = 'user_vibeform_preferences_user_id_foreign'
      `);
      expect(foreignKey.rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ delete_rule: "CASCADE" })]),
      );

      const checks = await client.raw(`
        SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '${FINAL_SCHEMA}'
          AND t.relname = 'user_vibeform_preferences'
          AND c.contype = 'c'
      `);
      const definitions = checks.rows.map((row: { definition: string }) => row.definition).join(" ");
      expect(definitions).toContain("shoulder-dominant");
      expect(definitions).toContain("balanced");
      expect(definitions).toContain("hip-dominant");
    });

    it("creates sessions table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "sessions");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "sessions");
      expect(columns.id).toBeDefined();
      expect(columns.owner_id).toBeDefined();
      expect(columns.plan_id).toBeDefined();
      expect(columns.title).toBeDefined();
      expect(columns.status).toBeDefined();
      expect(columns.visibility).toBeDefined();
      expect(columns.planned_at).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates exercises table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "exercises");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "exercises");
      expect(columns.id).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.owner_id).toBeDefined();
      expect(columns.type_code).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates session_exercises table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "session_exercises");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "session_exercises");
      expect(columns.id).toBeDefined();
      expect(columns.session_id).toBeDefined();
      expect(columns.exercise_id).toBeDefined();
      expect(columns.order_index).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates exercise_sets table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "exercise_sets");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "exercise_sets");
      expect(columns.id).toBeDefined();
      expect(columns.session_exercise_id).toBeDefined();
      expect(columns.order_index).toBeDefined();
      expect(columns.reps).toBeDefined();
      expect(columns.weight_kg).toBeDefined();
      expect(columns.rpe).toBeDefined();
      expect(columns.created_at).toBeDefined();
    });

    it("creates personal_records table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "personal_records");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "personal_records");
      expect(columns.id).toBeDefined();
      expect(columns.user_id).toBeDefined();
      expect(columns.exercise_id).toBeDefined();
      expect(columns.metric).toBeDefined();
      expect(columns.value).toBeDefined();
      expect(columns.achieved_at).toBeDefined();
      expect(columns.is_current).toBeDefined();
      expect(columns.created_at).toBeDefined();
    });

    it("creates feed_items table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "feed_items");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "feed_items");
      expect(columns.id).toBeDefined();
      expect(columns.owner_id).toBeDefined();
      expect(columns.session_id).toBeDefined();
      expect(columns.visibility).toBeDefined();
      expect(columns.created_at).toBeDefined();
      expect(columns.updated_at).toBeDefined();
    });

    it("creates user_points table with correct schema", async () => {
      const hasTable = await schemaHasTable(client, FINAL_SCHEMA, "user_points");
      expect(hasTable).toBe(true);

      const columns = await schemaColumnInfo(client, FINAL_SCHEMA, "user_points");
      expect(columns.id).toBeDefined();
      expect(columns.user_id).toBeDefined();
      expect(columns.points).toBeDefined();
      expect(columns.source_type).toBeDefined();
      expect(columns.awarded_at).toBeDefined();
    });

    it("creates foreign key constraints between users and profiles", async () => {
      const foreignKeys = await client.raw(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = '${FINAL_SCHEMA}'
          AND tc.table_name = 'profiles'
      `);

      expect(foreignKeys.rows.length).toBeGreaterThan(0);
    });

    it("creates indexes on frequently queried columns", async () => {
      const indexes = await client.raw(`
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE schemaname = '${FINAL_SCHEMA}'
          AND tablename IN ('users', 'sessions', 'exercises')
      `);

      expect(indexes.rows.length).toBeGreaterThan(0);
    });

    it("enforces current Phase 15 authentication schema invariants", async () => {
      const twoFactorColumns = await schemaColumnInfo(client, FINAL_SCHEMA, "user_2fa_settings");
      expect(twoFactorColumns.totp_secret).toBeDefined();
      expect(twoFactorColumns.is_enabled).toBeDefined();
      expect(twoFactorColumns.is_verified).toBeDefined();

      const blacklistColumns = await schemaColumnInfo(client, FINAL_SCHEMA, "blacklist");
      expect(blacklistColumns.email).toBeDefined();
      expect(blacklistColumns.active_from).toBeDefined();
      expect(blacklistColumns.active_to).toBeDefined();

      const challengeColumns = await schemaColumnInfo(client, FINAL_SCHEMA, "pending_2fa_sessions");
      expect(challengeColumns.failed_attempts).toBeDefined();
      expect(challengeColumns.last_failed_at).toBeDefined();
      expect(challengeColumns.expires_at).toBeDefined();
    });

    it("does not recreate dropped tables or users.username", async () => {
      expect((await schemaColumnInfo(client, FINAL_SCHEMA, "users")).username).toBeUndefined();
      expect(await schemaHasTable(client, FINAL_SCHEMA, "user_metrics")).toBe(false);
      expect(await schemaHasTable(client, FINAL_SCHEMA, "share_links")).toBe(false);
      expect(await schemaHasTable(client, FINAL_SCHEMA, "translation_cache")).toBe(false);
      expect(await schemaHasTable(client, FINAL_SCHEMA, "actual_exercise_attributes")).toBe(false);
    });
  });
});

async function ensureDatabaseExtensions(admin: knex.Knex): Promise<void> {
  await admin.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  // Note: uuid-ossp is not needed - we use gen_random_uuid() from pgcrypto
  // Attempt to create citext extension, fallback to domain if not available
  try {
    await admin.raw('CREATE EXTENSION IF NOT EXISTS "citext";');
  } catch (error: unknown) {
    // If citext extension is not available, create a domain as fallback
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("could not open extension control file") ||
      (errorMessage.includes("extension") && errorMessage.includes("does not exist"))
    ) {
      await admin.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'citext') THEN
            CREATE DOMAIN citext AS text;
          END IF;
        END $$;
      `);
    } else {
      // Re-throw if it's a different error
      throw error;
    }
  }
}
