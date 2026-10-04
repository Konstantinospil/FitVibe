import { generateKeyPairSync } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.READ_ONLY_MODE = "false";
process.env.DEBUG_AUTH_TOKENS = "true";
process.env.METRICS_ENABLED = process.env.METRICS_ENABLED ?? "false";
process.env.CSRF_ENABLED = process.env.CSRF_ENABLED ?? "false";
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? "http://localhost:5173";
process.env.CSRF_ALLOWED_ORIGINS = process.env.CSRF_ALLOWED_ORIGINS ?? "http://localhost:5173";
process.env.EMAIL_ENABLED = process.env.EMAIL_ENABLED ?? "false";
process.env.CLAMAV_ENABLED = process.env.CLAMAV_ENABLED ?? "false";
process.env.VAULT_ENABLED = process.env.VAULT_ENABLED ?? "false";
process.env.TOTP_ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const testJwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY ?? testJwtKeys.privateKey;
process.env.JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY ?? testJwtKeys.publicKey;

jest.setTimeout(1000 * 30);

beforeEach(async () => {
  try {
    const { clearRateLimiters } = await import("./src/middlewares/rate-limit.js");
    clearRateLimiters();
  } catch {
    // Ignore if rate-limit can't be imported (unit tests without that module)
  }
});

// Pre-import cleanup functions to ensure they're available synchronously
// This is critical for stopping Prometheus metrics timers
let stopMetricsCollectionFn: (() => void) | null = null;
let clearRateLimitersFn: (() => void) | null = null;

// Use dynamic imports to avoid circular dependencies and ensure modules are loaded
void import("./src/observability/metrics.js")
  .then((module) => {
    if (typeof module.stopMetricsCollection === "function") {
      stopMetricsCollectionFn = module.stopMetricsCollection;
    }
  })
  .catch(() => {
    // Ignore if metrics can't be imported
  });

void import("./src/middlewares/rate-limit.js")
  .then((module) => {
    if (typeof module.clearRateLimiters === "function") {
      clearRateLimitersFn = module.clearRateLimiters;
    }
  })
  .catch(() => {
    // Ignore if rate-limit can't be imported
  });

// Global teardown to ensure all async operations complete
afterAll(async () => {
  // Set timeout BEFORE async operations (Jest requires this)
  jest.setTimeout(60000);


  // CRITICAL: Stop Prometheus metrics collection FIRST and SYNCHRONOUSLY
  // These timers are the main culprit keeping the process alive
  // Try both pre-imported function and dynamic import for maximum reliability
  if (stopMetricsCollectionFn) {
    stopMetricsCollectionFn();
  }
  try {
    const metricsModule = await import("./src/observability/metrics.js");
    if (typeof metricsModule.stopMetricsCollection === "function") {
      metricsModule.stopMetricsCollection();
    }
  } catch {
    // Ignore if metrics can't be imported
  }

  // Clear rate limiters (they may have internal timers)
  // Try both pre-imported function and dynamic import for maximum reliability
  if (clearRateLimitersFn) {
    clearRateLimitersFn();
  }
  try {
    const { clearRateLimiters } = await import("./src/middlewares/rate-limit.js");
    clearRateLimiters();
  } catch {
    // Ignore if rate-limit can't be imported
  }

  const closePromises: Promise<void>[] = [];

  // Shutdown OpenTelemetry tracing if it was initialized
  try {
    const { shutdownTracing } = await import("./src/observability/tracing.js");
    closePromises.push(
      shutdownTracing().catch(() => {
        // Ignore errors during cleanup
      }),
    );
  } catch {
    // Ignore if tracing can't be imported
  }

  // Shutdown BullMQ queue service if it was initialized
  try {
    const { shutdownQueue } = await import("./src/jobs/services/queue.factory.js");
    closePromises.push(
      shutdownQueue().catch(() => {
        // Ignore errors during cleanup
      }),
    );
  } catch {
    // Ignore if queue factory can't be imported
  }

  // Close all database connection pools
  try {
    // Close connectionDb from connection.ts
    const { db: connectionDb } = await import("./src/db/connection.js");
    if (connectionDb && typeof connectionDb.destroy === "function") {
      closePromises.push(
        connectionDb.destroy().catch(() => {
          // Ignore errors during cleanup
        }),
      );
    }

    // Close db from index.ts (may be different instance)
    const { db: indexDb } = await import("./src/db/index.js");
    if (indexDb && typeof indexDb.destroy === "function") {
      // Check if it's a different instance before closing
      if (indexDb !== connectionDb) {
        closePromises.push(
          indexDb.destroy().catch(() => {
            // Ignore errors during cleanup
          }),
        );
      }
    }
  } catch {
    // Ignore if db modules can't be imported (e.g., in unit tests without DB)
  }

  // Wait for all close operations to complete
  await Promise.all(closePromises);

  // Allow any pending setImmediate callbacks to run
  await new Promise((resolve) => setImmediate(resolve));

  // Give any remaining async operations time to complete
  // Use real timers for this final cleanup
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });


  // Log what's keeping the process alive if available
  // This helps with debugging
  if (process.env.DEBUG_HANDLES === "true") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const whyIsNodeRunning = require("why-is-node-running") as () => unknown;
      // eslint-disable-next-line no-console
      console.log("Open handles:", whyIsNodeRunning());
    } catch {
      // why-is-node-running not available, skip
    }
  }
}, 60000); // Set timeout to 60 seconds for cleanup
