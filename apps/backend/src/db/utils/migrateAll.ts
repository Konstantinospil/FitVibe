import db from "../index.js";
import { logger } from "../../config/logger.js";
import { toErrorPayload } from "../../utils/error.utils.js";

/**
 * Applies all pending database migrations and verifies critical tables exist.
 * Includes connection timeout verification and critical table validation.
 *
 * @throws {Error} If connection timeout occurs, migrations fail, or critical tables are missing
 */
export async function migrateAll(): Promise<void> {
  try {
    logger.info("[db] Applying migrations (all environments)...");

    // Verify database connection with timeout
    const connectionTimeout = 5000; // 5 seconds
    const connectionPromise = db.raw("SELECT 1");
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Database connection timeout")),
        connectionTimeout,
      );
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
    logger.info("[db] Database connection verified");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await db.migrate.latest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const batchNo = result[0] as number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const migrations = result[1] as Array<{ name: string }>;

    if (migrations.length > 0) {
      logger.info(
        {
          migrations: migrations.map((m) => m.name),
          batchNo,
        },
        `[db] Applied ${migrations.length} migration(s) in batch ${batchNo}:`,
      );

      // Verify critical tables exist after migration
      const criticalTables = ["users", "profiles", "sessions", "feed_items", "exercises"];
      for (const table of criticalTables) {
        const exists = await db.schema.hasTable(table);
        if (!exists) {
          throw new Error(
            `Critical table '${table}' missing after migrations. Applied migrations: ${migrations.map((m) => m.name).join(", ")}`,
          );
        }
      }
      logger.info("[db] Critical tables verified");
    } else {
      logger.info("[db] No new migrations to apply.");
    }
    logger.info("[db] Migrations applied successfully.");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        ...toErrorPayload(error),
        context: "migrateAll",
        stack: errorStack,
      },
      `Failed to apply migrations: ${errorMessage}`,
    );
    throw error;
  } finally {
    await db.destroy();
  }
}

// Execute when run as script (still works with tsx)
// Skip immediate execution in test environment to allow testing
if (process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID) {
  migrateAll().catch((error: unknown) => {
    logger.error(toErrorPayload(error), "Failed to apply migrations.");
    process.exit(1);
  });
}
