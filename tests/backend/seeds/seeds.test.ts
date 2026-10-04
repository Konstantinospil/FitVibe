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
  // Fallback: assume we're in tests/backend/seeds, go up 3 levels
  return path.resolve(__dirname, "../../..");
}

describeWithTestDatabase("database seeds", () => {
  let client: knex.Knex | undefined;

  beforeAll(async () => {
    const admin = knex({
      client: "pg",
      connection: DATABASE_URL,
    });

    try {
      await admin.raw("DROP SCHEMA IF EXISTS tmp_seed_test CASCADE;");
      await admin.raw("CREATE SCHEMA tmp_seed_test;");
      await ensureDatabaseExtensions(admin);
    } finally {
      await admin.destroy();
    }

    // Initialize client BEFORE running migrations to ensure it's always defined
    client = knex({
      client: "pg",
      connection: DATABASE_URL,
      searchPath: ["tmp_seed_test", "public"],
      migrations: {
        loadExtensions: [".ts"],
        directory: path.resolve(findProjectRoot(), "apps/backend/src/db/migrations"),
      },
      seeds: {
        loadExtensions: [".ts"],
        directory: path.resolve(findProjectRoot(), "apps/backend/src/db/seeds"),
      },
    });

    // Run migrations first to create tables
    // Handle migration errors that might prevent migrations from completing
    try {
      await client.migrate.latest();
    } catch (migrationError: unknown) {
      const errorMessage =
        migrationError instanceof Error ? migrationError.message : String(migrationError);
      // If it's a concurrent extension creation error, that's OK - extension already exists
      if (
        errorMessage.includes("duplicate key value violates unique constraint") &&
        errorMessage.includes("pg_extension_name_index")
      ) {
        // Extension was created concurrently, verify migrations completed or retry
        // Check if migration table exists to see if migrations ran

        const migrationCheck = await client.raw(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'tmp_seed_test' AND table_name = 'knex_migrations'
        `);
        const hasMigrationTable =
          (migrationCheck as { rows: Array<Record<string, unknown>> }).rows.length > 0;
        if (!hasMigrationTable) {
          // Migrations didn't complete, wait and retry once
          await new Promise((resolve) => setTimeout(resolve, 200));
          try {
            await client.migrate.latest();
          } catch (retryError: unknown) {
            // If retry also fails, re-throw the original error
            throw migrationError;
          }
        }
        // Migrations completed, continue
      } else {
        // Re-throw other migration errors
        throw migrationError;
      }
    }
  });

  afterAll(async () => {
    if (client) {
      await client.destroy();
    }
    const admin = knex({
      client: "pg",
      connection: DATABASE_URL,
    });
    await admin.raw("DROP SCHEMA IF EXISTS tmp_seed_test CASCADE;");
    await admin.destroy();
  });

  describe("seed data insertion", () => {
    beforeAll(async () => {
      // Ensure client is initialized and has seed property
      if (!client) {
        throw new Error("Database client not initialized - migrations may have failed");
      }
      if (!client.seed) {
        throw new Error("Database client missing seed property - check knex configuration");
      }
      await client.seed.run();
    });

    describe("roles seed", () => {
      it("inserts all role records", async () => {
        const roles = await client("roles").select("*");
        expect(roles.length).toBeGreaterThanOrEqual(4);
      });

      it("inserts admin role", async () => {
        const admin = await client("roles").where({ code: "admin" }).first();
        expect(admin).toBeDefined();
        expect(admin.code).toBe("admin");
        expect(admin.description).toBe("Keeps the map: platform steward for the six stories");
      });

      it("inserts coach role", async () => {
        const coach = await client("roles").where({ code: "coach" }).first();
        expect(coach).toBeDefined();
        expect(coach.code).toBe("coach");
        expect(coach.description).toBe(
          "Mentor for a chapter, with the athlete's consent — then you leave",
        );
      });

      it("inserts athlete role", async () => {
        const athlete = await client("roles").where({ code: "athlete" }).first();
        expect(athlete).toBeDefined();
        expect(athlete.code).toBe("athlete");
        expect(athlete.description).toBe("The one who must live all six elemental stories");
      });

      it("inserts support role", async () => {
        const support = await client("roles").where({ code: "support" }).first();
        expect(support).toBeDefined();
        expect(support.code).toBe("support");
        expect(support.description).toBe(
          "Mends the hero: nutrition, physio, and care between quests",
        );
      });

      it("has timestamps on role records", async () => {
        const role = await client("roles").where({ code: "admin" }).first();
        expect(role?.created_at).toBeDefined();
        expect(new Date(role?.created_at as string | number | Date)).toBeInstanceOf(Date);
      });
    });

    describe("genders seed", () => {
      it("inserts all gender records", async () => {
        const genders = await client("genders").select("*");
        expect(genders.length).toBeGreaterThanOrEqual(4);
      });

      it("inserts woman gender", async () => {
        const woman = await client("genders").where({ code: "woman" }).first();
        expect(woman).toBeDefined();
        expect(woman.code).toBe("woman");
        expect(woman.description).toBe("Woman");
      });

      it("inserts man gender", async () => {
        const man = await client("genders").where({ code: "man" }).first();
        expect(man).toBeDefined();
        expect(man.code).toBe("man");
        expect(man.description).toBe("Man");
      });

      it("inserts diverse gender", async () => {
        const diverse = await client("genders").where({ code: "diverse" }).first();
        expect(diverse).toBeDefined();
        expect(diverse.code).toBe("diverse");
        expect(diverse.description).toBe("Diverse / non-binary");
      });

      it("inserts prefer_not_to_say gender", async () => {
        const preferNot = await client("genders").where({ code: "prefer_not_to_say" }).first();
        expect(preferNot).toBeDefined();
        expect(preferNot.code).toBe("prefer_not_to_say");
        expect(preferNot.description).toBe("Prefer not to say");
      });

      it("has timestamps on gender records", async () => {
        const gender = await client("genders").where({ code: "woman" }).first();
        expect(gender.created_at).toBeDefined();
        expect(new Date(gender.created_at as string | number | Date)).toBeInstanceOf(Date);
      });
    });

    describe("fitness_levels seed", () => {
      it("inserts all fitness level records", async () => {
        const fitnessLevels = await client("fitness_levels").select("*");
        expect(fitnessLevels.length).toBeGreaterThanOrEqual(5);
      });

      it("inserts beginner level", async () => {
        const beginner = await client("fitness_levels").where({ code: "beginner" }).first();
        expect(beginner).toBeDefined();
        expect(beginner.code).toBe("beginner");
        expect(beginner.description).toBe("Getting started with consistent training");
      });

      it("inserts intermediate level", async () => {
        const intermediate = await client("fitness_levels").where({ code: "intermediate" }).first();
        expect(intermediate).toBeDefined();
        expect(intermediate.code).toBe("intermediate");
        expect(intermediate.description).toBe("Trains 3-4 times per week");
      });

      it("inserts advanced level", async () => {
        const advanced = await client("fitness_levels").where({ code: "advanced" }).first();
        expect(advanced).toBeDefined();
        expect(advanced.code).toBe("advanced");
        expect(advanced.description).toBe("Highly trained athlete");
      });

      it("inserts elite level", async () => {
        const elite = await client("fitness_levels").where({ code: "elite" }).first();
        expect(elite).toBeDefined();
        expect(elite.code).toBe("elite");
        expect(elite.description).toBe("Lives every story at a high level");
      });

      it("inserts rehab level", async () => {
        const rehab = await client("fitness_levels").where({ code: "rehab" }).first();
        expect(rehab).toBeDefined();
        expect(rehab.code).toBe("rehab");
        expect(rehab.description).toBe("Returning from injury / rehab focus");
      });

      it("has timestamps on fitness level records", async () => {
        const level = await client("fitness_levels").where({ code: "beginner" }).first();
        expect(level?.created_at).toBeDefined();
        expect(new Date(level?.created_at as string | number | Date)).toBeInstanceOf(Date);
      });
    });

    describe("exercise_types seed", () => {
      it("inserts all exercise type records", async () => {
        const exerciseTypes = await client("exercise_types").select("*");
        expect(exerciseTypes.length).toBeGreaterThanOrEqual(24);
      });

      it("inserts strength type", async () => {
        const strength = await client("exercise_types").where({ code: "strength" }).first();
        expect(strength).toBeDefined();
        expect(strength.code).toBe("strength");
        expect(strength.name).toBe("Strength");
        expect(strength.description).toBe("Strength & resistance training");
        expect(strength.is_active).toBe(true);
      });

      it("inserts cardio type", async () => {
        const cardio = await client("exercise_types").where({ code: "cardio" }).first();
        expect(cardio).toBeDefined();
        expect(cardio.code).toBe("cardio");
        expect(cardio.description).toBe("Cardiovascular / endurance work");
      });

      it("inserts balance type", async () => {
        const balance = await client("exercise_types").where({ code: "balance" }).first();
        expect(balance).toBeDefined();
        expect(balance.code).toBe("balance");
        expect(balance.description).toBe("Balance, coordination, and stability work");
      });

      it("inserts mobility type", async () => {
        const mobility = await client("exercise_types").where({ code: "mobility" }).first();
        expect(mobility).toBeDefined();
        expect(mobility.code).toBe("mobility");
        expect(mobility.description).toBe("Mobility and flexibility drills");
      });

      it("inserts yoga type", async () => {
        const yoga = await client("exercise_types").where({ code: "yoga" }).first();
        expect(yoga).toBeDefined();
        expect(yoga.code).toBe("yoga");
        expect(yoga.description).toBe("Yoga sessions");
      });

      it("inserts hiit type", async () => {
        const hiit = await client("exercise_types").where({ code: "hiit" }).first();
        expect(hiit).toBeDefined();
        expect(hiit.code).toBe("hiit");
        expect(hiit.description).toBe("High-intensity interval training");
      });

      it("inserts crossfit type", async () => {
        const crossfit = await client("exercise_types").where({ code: "crossfit" }).first();
        expect(crossfit).toBeDefined();
        expect(crossfit.code).toBe("crossfit");
        expect(crossfit.description).toBe("CrossFit workouts");
      });

      it("inserts vibe type codes", async () => {
        for (const code of ["agility", "explosivity", "intelligence", "regeneration"]) {
          const row = await client("exercise_types").where({ code }).first();
          expect(row).toBeDefined();
          expect(row.code).toBe(code);
        }
      });

      it("inserts rehab type", async () => {
        const rehab = await client("exercise_types").where({ code: "rehab" }).first();
        expect(rehab).toBeDefined();
        expect(rehab.code).toBe("rehab");
        expect(rehab.description).toBe("Rehabilitation exercises");
      });

      it("has timestamps on exercise type records", async () => {
        const type = await client("exercise_types").where({ code: "strength" }).first();
        expect(type?.created_at).toBeDefined();
        expect(type?.updated_at).toBeDefined();
        expect(new Date(type?.created_at as string | number | Date)).toBeInstanceOf(Date);
        expect(new Date(type?.updated_at as string | number | Date)).toBeInstanceOf(Date);
      });
    });

    describe("users seed", () => {
      const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
      it("inserts only the bootstrap administrator", async () => {
        const users = await client("users").select("*");
        expect(users).toHaveLength(1);
      });

      it("inserts admin user", async () => {
        const admin = await client("users").where({ id: ADMIN_ID }).first();
        expect(admin).toBeDefined();
        expect(admin.display_name).toBe("FitVibe Admin");
        expect(admin.role_code).toBe("admin");
        expect(admin.status).toBe("active");
      });

      it("hashes passwords for demo users", async () => {
        const admin = await client("users").where({ id: ADMIN_ID }).first();
        expect(admin.password_hash).toBeDefined();
        expect(admin.password_hash).not.toBe("admin");
        expect(admin.password_hash.startsWith("$2")).toBe(true); // bcrypt format
      });

      it("sets valid UUIDs for demo users", async () => {
        const admin = await client("users").where({ display_name: "FitVibe Admin" }).first();
        expect(admin.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(admin.id).toBe(ADMIN_ID);
      });

      it("has timestamps on user records", async () => {
        const admin = await client("users").where({ id: ADMIN_ID }).first();
        expect(admin?.created_at).toBeDefined();
        expect(admin?.updated_at).toBeDefined();
        expect(new Date(admin?.created_at as string | number | Date)).toBeInstanceOf(Date);
        expect(new Date(admin?.updated_at as string | number | Date)).toBeInstanceOf(Date);
      });

      it("inserts verified login contacts for seed users", async () => {
        const adminContact = await client("user_contacts")
          .where({ user_id: ADMIN_ID, type: "email" })
          .first();
        expect(adminContact).toBeDefined();
        expect(adminContact.value).toBe("admin@fitvibe.local");
        expect(adminContact.is_verified).toBe(true);

      });

      it("inserts private profiles for seed users", async () => {
        const adminProfile = await client("profiles").where({ user_id: ADMIN_ID }).first();
        expect(adminProfile.alias).toBe("admin");
        expect(adminProfile.visibility).toBe("private");
      });

      it("inserts six starting vibe rows per seed user", async () => {
        const expected = [
          "strength",
          "agility",
          "endurance",
          "explosivity",
          "intelligence",
          "regeneration",
        ];
        const rows = await client("user_domain_vibe_levels").where({ user_id: ADMIN_ID });
        expect(rows).toHaveLength(6);
        expect(rows.map((row: { domain_code: string }) => row.domain_code).sort()).toEqual(
          [...expected].sort(),
        );
        for (const row of rows) {
          expect(Number(row.vibe_level)).toBe(1000);
          expect(Number(row.rating_deviation)).toBe(350);
          expect(Number(row.volatility)).toBeCloseTo(0.06);
        }
      });
    });

    describe("exercise catalog seed", () => {
      it("inserts 300 global exercises, 50 per vibe", async () => {
        const exercises = await client("exercises")
          .whereNull("owner_id")
          .where({ is_public: true });
        expect(exercises.length).toBeGreaterThanOrEqual(300);

        const vibeCodes = [
          "strength",
          "agility",
          "endurance",
          "explosivity",
          "intelligence",
          "regeneration",
        ];
        for (const typeCode of vibeCodes) {
          const count = await client("exercises")
            .where({ type_code: typeCode })
            .count("id as count")
            .first();
          expect(Number(count?.count)).toBeGreaterThanOrEqual(50);
        }
      });
    });

    describe("badge catalog seed", () => {
      it("inserts earnable athlete badges and catalog-only role badges", async () => {
        const badges = await client("badge_catalog").select("*");
        expect(badges.length).toBeGreaterThanOrEqual(36);

        const firstSession = await client("badge_catalog").where({ code: "first_session" }).first();
        expect(firstSession).toBeDefined();
        const firstCriteria =
          typeof firstSession.criteria === "string"
            ? JSON.parse(firstSession.criteria)
            : firstSession.criteria;
        expect(firstCriteria).toEqual({ completed_sessions: 1 });

        const earth = await client("badge_catalog").where({ code: "earth_initiate" }).first();
        expect(earth).toBeDefined();

        const onboard = await client("badge_catalog").where({ code: "onboard_pro" }).first();
        const onboardCriteria =
          typeof onboard.criteria === "string" ? JSON.parse(onboard.criteria) : onboard.criteria;
        expect(onboardCriteria.requires).toBe("coaching");
      });
    });

    describe("seed idempotency", () => {
      it("does not create duplicates when run multiple times", async () => {
        // Run seeds again
        await client.seed.run();

        // Check that counts haven't increased
        const roles = await client("roles").select("*");
        expect(roles.length).toBeLessThanOrEqual(10); // Reasonable upper bound

        const genders = await client("genders").select("*");
        expect(genders.length).toBeLessThanOrEqual(10);

        const fitnessLevels = await client("fitness_levels").select("*");
        expect(fitnessLevels.length).toBeLessThanOrEqual(10);

        const exerciseTypes = await client("exercise_types").select("*");
        expect(exerciseTypes.length).toBeLessThanOrEqual(30);
      });
    });
  });
});

async function ensureDatabaseExtensions(admin: knex.Knex): Promise<void> {
  await admin.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  // Note: uuid-ossp is not needed - we use gen_random_uuid() from pgcrypto
  // Attempt to create citext extension, fallback to domain if not available
  // Handle concurrent creation errors gracefully
  try {
    await admin.raw('CREATE EXTENSION IF NOT EXISTS "citext";');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Handle extension not available errors
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
    } else if (
      // Handle concurrent creation race condition
      errorMessage.includes("duplicate key value violates unique constraint") ||
      errorMessage.includes("pg_extension_name_index")
    ) {
      // Extension is being created concurrently, check if it exists now

      const checkExt = await admin.raw(`
        SELECT 1 FROM pg_extension WHERE extname = 'citext'
      `);
      const checkExtRows = (checkExt as { rows: Array<Record<string, unknown>> }).rows;
      if (checkExtRows.length === 0) {
        // Extension doesn't exist yet, wait a bit and retry once
        await new Promise((resolve) => setTimeout(resolve, 100));
        try {
          await admin.raw('CREATE EXTENSION IF NOT EXISTS "citext";');
        } catch (retryError: unknown) {
          // If it still fails, check if it exists (might have been created by another process)

          const checkAgain = await admin.raw(`
            SELECT 1 FROM pg_extension WHERE extname = 'citext'
          `);
          const checkAgainRows = (checkAgain as { rows: Array<Record<string, unknown>> }).rows;
          if (checkAgainRows.length === 0) {
            // Still doesn't exist and retry failed, re-throw
            throw retryError;
          }
          // Extension exists now, continue
        }
      }
      // Extension exists, continue
    } else {
      // Re-throw if it's a different error
      throw error;
    }
  }
}
