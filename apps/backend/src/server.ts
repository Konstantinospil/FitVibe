import { config as loadEnv } from "dotenv";

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on"]);

function isEnabled(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? "").trim().toLowerCase());
}

async function bootstrapRuntimeSecrets(): Promise<void> {
  loadEnv();

  const [{ logger }, secrets] = await Promise.all([
    import("./config/logger.js"),
    import("./services/secrets.service.js"),
  ]);

  if (!isEnabled(process.env.VAULT_ENABLED)) {
    logger.info("[server] Secrets manager disabled - using environment/files");
    return;
  }

  const token = process.env.VAULT_TOKEN?.trim();
  if (!token) {
    throw new Error("VAULT_ENABLED=true but VAULT_TOKEN is not set");
  }

  secrets.initializeSecretsManager({
    provider: "vault",
    vault: {
      enabled: true,
      addr: process.env.VAULT_ADDR?.trim() || "http://localhost:8200",
      token,
      namespace: process.env.VAULT_NAMESPACE?.trim() || undefined,
    },
  });

  const [jwtKeys, databaseUrl] = await Promise.all([
    secrets.getJWTKeys(),
    secrets.getDatabaseURL(),
  ]);

  if (!process.env.JWT_PRIVATE_KEY && jwtKeys?.privateKey) {
    process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
  }
  if (!process.env.JWT_PUBLIC_KEY && jwtKeys?.publicKey) {
    process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
  }
  if (!process.env.DATABASE_URL && databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }

  logger.info("[server] Runtime secrets loaded from Vault before application bootstrap");
}

export async function startServer(): Promise<void> {
  await bootstrapRuntimeSecrets();

  const [{ default: app }, { env }, { logger }] = await Promise.all([
    import("./app.js"),
    import("./config/env.js"),
    import("./config/logger.js"),
  ]);

  if (env.isProduction) {
    const { checkHealth } = await import("./services/antivirus.service.js");
    if (!(await checkHealth())) {
      throw new Error("ClamAV health check failed during production startup");
    }

    const { checkQueueHealth } = await import("./jobs/services/queue.factory.js");
    if (!(await checkQueueHealth())) {
      throw new Error("Redis/BullMQ health check failed during production startup");
    }
  }

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "FitVibe Backend running");
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID) {
  void startServer().catch(async (error: unknown) => {
    const { logger } = await import("./config/logger.js");
    logger.error({ err: error }, "[server] Failed to start");
    process.exit(1);
  });
}
