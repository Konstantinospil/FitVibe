/**
 * Secrets Management Service (I-12)
 *
 * Unified interface for loading secrets from:
 * - HashiCorp Vault (optional)
 * - Environment variables (fallback)
 *
 * Per TDD Section 10.6 & 13.7, supports:
 * - Provider-selected Vault reads/writes
 * - Environment fallback on reads
 * - No cloud SDK required for local startup
 *
 * @see apps/docs/2*.Technical_Design_Document*.md Section 10.6 & 13.7
 */

import { logger } from "../config/logger.js";
import { createVaultClient, type VaultClient } from "./vault.client.js";

export type SecretProvider = "vault" | "env";

interface SecretConfig {
  provider: SecretProvider;
  vault?: {
    enabled: boolean;
    addr: string;
    token: string;
    namespace?: string;
  };
}

let vaultClient: VaultClient | null = null;
let config: SecretConfig | null = null;

const ENV_SECRET_ALIASES: Record<string, string> = {
  "secret/jwt:private": "JWT_PRIVATE_KEY",
  "secret/jwt:public": "JWT_PUBLIC_KEY",
  "secret/database:url": "DATABASE_URL",
};

function getEnvironmentSecret(key: string, field?: string): string | null {
  const alias = ENV_SECRET_ALIASES[`${key}:${field ?? ""}`];
  const genericName = ["FITVIBE_SECRET", key, field]
    .filter((part): part is string => {
      return Boolean(part);
    })
    .join("_")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const value = process.env[alias ?? genericName];
  return value === undefined ? null : value;
}

/**
 * Initialize secrets manager with configuration
 */
export function initializeSecretsManager(secretConfig: SecretConfig): void {
  if (secretConfig.provider !== "vault" && secretConfig.provider !== "env") {
    throw new Error("Unsupported secrets provider");
  }
  config = secretConfig;
  vaultClient = null;

  // Initialize Vault only when it is the selected provider.
  if (secretConfig.provider === "vault" && secretConfig.vault?.enabled) {
    vaultClient = createVaultClient({
      endpoint: secretConfig.vault.addr,
      token: secretConfig.vault.token,
      namespace: secretConfig.vault.namespace,
    });

    logger.info(
      {
        provider: "vault",
        addr: secretConfig.vault.addr,
      },
      "[secrets] Vault client initialized",
    );
  }

  if (secretConfig.provider === "env" || !secretConfig.vault?.enabled) {
    logger.warn("[secrets] No secrets manager enabled - using environment variables only");
  }
}

/**
 * Get a secret value from the configured provider
 *
 * @param key - Secret key/path
 * @param field - Optional field name for structured secrets
 * @returns Secret value or null if not found
 *
 * @example
 * // Vault KV v2
 * const jwtPrivateKey = await getSecret('jwt/keys', 'private');
 *
 * @example
 * // AWS Secrets Manager
 * const dbPassword = await getSecret('prod/database/password');
 */
export async function getSecret(key: string, field?: string): Promise<string | null> {
  if (!config) {
    logger.error("[secrets] Secrets manager not initialized");
    return null;
  }

  if (config.provider === "vault" && config.vault?.enabled && vaultClient) {
    try {
      const result = await vaultClient.read<{
        data?: { data?: Record<string, unknown> } & Record<string, unknown>;
      }>(key);
      if (result?.data) {
        const secretData = result.data.data || result.data;
        if (field) {
          const value = secretData[field];
          if (typeof value === "string") {
            return value;
          }
        } else if (typeof secretData === "string") {
          return secretData;
        } else if (Object.keys(secretData).length === 1 && typeof secretData.value === "string") {
          return secretData.value;
        } else {
          return JSON.stringify(secretData);
        }
      }
      logger.warn(
        { key, field },
        "[secrets] Secret not found in Vault; trying environment fallback",
      );
    } catch (error) {
      logger.error(
        { err: error, key, field },
        "[secrets] Vault read failed; trying environment fallback",
      );
    }
  }

  return getEnvironmentSecret(key, field);
}

/**
 * Write a secret to the configured provider
 *
 * @param key - Secret key/path
 * @param value - Secret value (string or object)
 * @returns True if successful, false otherwise
 *
 * @example
 * await writeSecret('jwt/keys', {
 *   private: privateKey,
 *   public: publicKey,
 *   kid: keyId
 * });
 */
export async function writeSecret(
  key: string,
  value: string | Record<string, unknown>,
): Promise<boolean> {
  if (!config) {
    logger.error("[secrets] Secrets manager not initialized");
    return false;
  }

  // Write only to the configured authoritative provider.
  if (config.provider === "vault" && config.vault?.enabled && vaultClient) {
    try {
      const data = typeof value === "string" ? { value } : value;
      await vaultClient.write(key, data);

      logger.info({ key }, "[secrets] Secret written to Vault");
      return true;
    } catch (error) {
      logger.error({ err: error, key }, "[secrets] Vault write failed");
      return false;
    }
  }

  logger.error("[secrets] No secrets provider available for write");
  return false;
}

/**
 * Load JWT keys from secrets manager
 *
 * @returns Object with privateKey and publicKey, or null if not found
 *
 * @example
 * const keys = await getJWTKeys();
 * if (keys) {
 *   const { privateKey, publicKey } = keys;
 * }
 */
export async function getJWTKeys(): Promise<{
  privateKey: string;
  publicKey: string;
} | null> {
  try {
    const privateKey = await getSecret("secret/jwt", "private");
    const publicKey = await getSecret("secret/jwt", "public");

    if (!privateKey || !publicKey) {
      logger.warn("[secrets] JWT keys not found in secrets manager");
      return null;
    }

    logger.info("[secrets] JWT keys loaded from secrets manager");
    return { privateKey, publicKey };
  } catch (error) {
    logger.error({ err: error }, "[secrets] Failed to load JWT keys");
    return null;
  }
}

/**
 * Load database credentials from secrets manager
 *
 * @returns Database URL or null if not found
 */
export async function getDatabaseURL(): Promise<string | null> {
  try {
    const dbUrl = await getSecret("secret/database", "url");

    if (!dbUrl) {
      logger.warn("[secrets] Database URL not found in secrets manager");
      return null;
    }

    logger.info("[secrets] Database URL loaded from secrets manager");
    return dbUrl;
  } catch (error) {
    logger.error({ err: error }, "[secrets] Failed to load database URL");
    return null;
  }
}

/**
 * Health check for secrets manager connectivity
 *
 * @returns True if secrets manager is accessible
 */
export async function checkSecretsHealth(): Promise<boolean> {
  if (!config) {
    return false;
  }

  // Check Vault
  if (config.vault?.enabled && vaultClient) {
    try {
      await vaultClient.health();
      return true;
    } catch (error) {
      logger.error({ err: error }, "[secrets] Vault health check failed");
      return false;
    }
  }

  return false;
}
