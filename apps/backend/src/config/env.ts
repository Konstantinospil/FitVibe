import { config as loadEnv } from "dotenv";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { createHash, generateKeyPairSync, createPublicKey } from "node:crypto";
import { logger } from "./logger.js";

loadEnv();

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on"]);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().default("localhost"),
  PGPORT: z.coerce.number().default(5432),
  PGDATABASE: z.string().default("fitvibe"),
  PGUSER: z.string().default("fitvibe"),
  PGPASSWORD: z.string().default("fitvibe"),
  PGSSL: z.string().optional(),
  PGSSL_REJECT_UNAUTHORIZED: z.string().optional(),
  PGSSL_CA: z.string().optional(),
  PGSSL_CERT: z.string().optional(),
  PGSSL_KEY: z.string().optional(),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().default(60 * 60 * 24 * 14),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  CSRF_ALLOWED_ORIGINS: z.string().optional(),
  CSRF_ENABLED: z.string().optional(),
  METRICS_ENABLED: z.string().optional(),
  ACCESS_COOKIE_NAME: z.string().default("fitvibe_access"),
  REFRESH_COOKIE_NAME: z.string().default("fitvibe_refresh"),
  APP_BASE_URL: z.string().default("http://localhost:4000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_PRIVATE_KEY_PATH: z.string().default("./keys/jwt_rs256.key"),
  JWT_PUBLIC_KEY_PATH: z.string().default("./keys/jwt_rs256.pub"),
  MEDIA_STORAGE_ROOT: z.string().default("./storage"),
  READ_ONLY_MODE: z.string().optional(),
  CLAMAV_ENABLED: z.string().optional(),
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().default(3310),
  CLAMAV_TIMEOUT: z.coerce.number().default(60000),
  VAULT_ENABLED: z.string().optional(),
  VAULT_ADDR: z.string().default("http://localhost:8200"),
  VAULT_TOKEN: z.string().optional(),
  VAULT_NAMESPACE: z.string().optional(),
  JWT_KEY_ROTATION_DAYS: z.coerce.number().default(90),
  EMAIL_ENABLED: z.string().optional(),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("FitVibe"),
  SMTP_FROM_EMAIL: z.string().optional(),
  APP_NAME: z.string().default("FitVibe"),
  REDIS_ENABLED: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  BULLMQ_CONCURRENCY: z.coerce.number().default(5),
  BULLMQ_RATE_LIMIT_MAX: z.coerce.number().default(100),
  BULLMQ_RATE_LIMIT_DURATION: z.coerce.number().default(60000),
  TRUST_PROXY: z.string().optional(),
  TRUSTED_PROXY_IPS: z.string().optional(),
  TOTP_ENCRYPTION_KEY: z.string().optional(),
});

const raw = EnvSchema.parse(process.env);
const defaultCsrfEnabled = raw.NODE_ENV !== "test";

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

const parseList = (value: string | undefined): string[] =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const normalizeOrigin = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const { origin } = new URL(trimmed);
    return origin;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
};

const normalizeKey = (value?: string) => value?.replace(/\\n/g, "\n").trim();

let privateKey = normalizeKey(raw.JWT_PRIVATE_KEY);
let publicKey = normalizeKey(raw.JWT_PUBLIC_KEY);

if (!privateKey && raw.JWT_PRIVATE_KEY_PATH) {
  const resolved = path.resolve(raw.JWT_PRIVATE_KEY_PATH);
  if (fs.existsSync(resolved)) {
    privateKey = fs.readFileSync(resolved, "utf8");
  }
}

if (!publicKey && raw.JWT_PUBLIC_KEY_PATH) {
  const resolved = path.resolve(raw.JWT_PUBLIC_KEY_PATH);
  if (fs.existsSync(resolved)) {
    publicKey = fs.readFileSync(resolved, "utf8");
  }
}

if (privateKey && !publicKey) {
  try {
    publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
    logger.info("[env] JWT public key derived from configured private key.");
  } catch (error) {
    throw new Error("JWT_PRIVATE_KEY is not a valid RSA private key.", { cause: error });
  }
}

if (!privateKey && publicKey) {
  throw new Error(
    "JWT_PUBLIC_KEY is configured without a matching JWT_PRIVATE_KEY. " +
      "Configure the signing private key as well.",
  );
}

if (!privateKey && !publicKey) {
  if (raw.NODE_ENV === "production") {
    throw new Error(
      "Production requires persistent JWT signing keys. Configure JWT_PRIVATE_KEY/JWT_PUBLIC_KEY " +
        "or mount JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH.",
    );
  }

  const generated = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = generated.privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  publicKey = generated.publicKey.export({ type: "spki", format: "pem" }).toString();
  logger.warn("[env] JWT keys not provided; generated an ephemeral non-production key pair.");
}

if (!privateKey || !publicKey) {
  throw new Error("Unable to resolve RSA key pair for JWT signing.");
}

const derivedPublicKey = createPublicKey(privateKey)
  .export({ type: "spki", format: "pem" })
  .toString();
const normalizedPublicKey = createPublicKey(publicKey)
  .export({ type: "spki", format: "pem" })
  .toString();

if (derivedPublicKey !== normalizedPublicKey) {
  throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY do not form a matching key pair.");
}

publicKey = normalizedPublicKey;

const defaultOrigins = [
  normalizeOrigin(raw.FRONTEND_URL),
  normalizeOrigin(raw.APP_BASE_URL),
].filter(Boolean) as string[];

const allowedOrigins = (() => {
  const configured = parseList(raw.ALLOWED_ORIGINS)
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean) as string[];
  const candidates = configured.length ? configured : defaultOrigins;
  return Array.from(new Set(candidates));
})();

const csrfAllowedOrigins = (() => {
  const configured = parseList(raw.CSRF_ALLOWED_ORIGINS)
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean) as string[];
  return configured.length ? configured : allowedOrigins;
})();

export const env = {
  NODE_ENV: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  PORT: raw.PORT,
  DATABASE_URL: raw.DATABASE_URL,
  database: {
    host: raw.PGHOST,
    port: raw.PGPORT,
    name: raw.PGDATABASE,
    user: raw.PGUSER,
    password: raw.PGPASSWORD,
    ssl: parseBoolean(raw.PGSSL, false),
  },
  ACCESS_TOKEN_TTL: raw.ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL: raw.REFRESH_TOKEN_TTL_SEC,
  COOKIE_DOMAIN: raw.COOKIE_DOMAIN?.trim() || undefined,
  COOKIE_SECURE: parseBoolean(raw.COOKIE_SECURE, raw.NODE_ENV === "production"),
  ACCESS_COOKIE_NAME: raw.ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME: raw.REFRESH_COOKIE_NAME,
  allowedOrigins,
  csrf: {
    enabled: parseBoolean(raw.CSRF_ENABLED, defaultCsrfEnabled),
    allowedOrigins: csrfAllowedOrigins,
  },
  metricsEnabled: parseBoolean(raw.METRICS_ENABLED, true),
  appBaseUrl: raw.APP_BASE_URL,
  frontendUrl: raw.FRONTEND_URL,
  appName: raw.APP_NAME,
  mediaStorageRoot: raw.MEDIA_STORAGE_ROOT,
  readOnlyMode: parseBoolean(raw.READ_ONLY_MODE, false),
  clamav: {
    enabled: parseBoolean(raw.CLAMAV_ENABLED, false),
    host: raw.CLAMAV_HOST,
    port: raw.CLAMAV_PORT,
    timeout: raw.CLAMAV_TIMEOUT,
  },
  vault: {
    enabled: parseBoolean(raw.VAULT_ENABLED, false),
    addr: raw.VAULT_ADDR,
    token: raw.VAULT_TOKEN,
    namespace: raw.VAULT_NAMESPACE,
  },
  jwtKeyRotationDays: raw.JWT_KEY_ROTATION_DAYS,
  redis: {
    enabled: parseBoolean(raw.REDIS_ENABLED, false),
    host: raw.REDIS_HOST,
    port: raw.REDIS_PORT,
    password: raw.REDIS_PASSWORD,
    db: raw.REDIS_DB,
  },
  bullmq: {
    concurrency: raw.BULLMQ_CONCURRENCY,
    rateLimitMax: raw.BULLMQ_RATE_LIMIT_MAX,
    rateLimitDuration: raw.BULLMQ_RATE_LIMIT_DURATION,
  },
  email: {
    enabled: parseBoolean(raw.EMAIL_ENABLED, false),
    smtp: {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      secure: parseBoolean(raw.SMTP_SECURE, false),
      user: raw.SMTP_USER,
      pass: raw.SMTP_PASS,
    },
    from: {
      name: raw.SMTP_FROM_NAME,
      email: raw.SMTP_FROM_EMAIL || raw.SMTP_USER,
    },
  },
  // Forwarded client IPs are trusted only when proxy mode is explicitly enabled
  // and the immediate TCP peer is explicitly allowlisted.
  trustProxy: parseBoolean(raw.TRUST_PROXY, false),
  trustedProxyIps: parseList(raw.TRUSTED_PROXY_IPS),
  totpEncryptionKey: raw.TOTP_ENCRYPTION_KEY,
} as const;

export const RSA_KEYS = {
  privateKey: privateKey,
  publicKey: publicKey,
};

const publicKeyObject = createPublicKey(publicKey);
const jwk = publicKeyObject.export({ format: "jwk" }) as JsonWebKey;
const kid = createHash("sha256").update(publicKey).digest("base64url").slice(0, 16);

export const JWKS = {
  keys: [
    {
      kty: "RSA",
      use: "sig",
      alg: "RS256",
      kid,
      n: jwk.n!,
      e: jwk.e!,
    },
  ],
} as const;
