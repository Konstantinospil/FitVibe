import crypto from "node:crypto";
import { env } from "../../config/env.js";

const ENVELOPE_PREFIX = "enc:v1";
const AAD = Buffer.from("fitvibe:totp:v1", "utf8");

function resolveKey(): Buffer {
  const raw = env.totpEncryptionKey?.trim();
  if (!raw) {
    throw new Error("TOTP_ENCRYPTION_KEY is required for TOTP secret encryption");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error("TOTP_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex chars or base64");
}

export function isEncryptedTotpSecret(value: string): boolean {
  return value.startsWith(`${ENVELOPE_PREFIX}:`);
}

export function encryptTotpSecret(secret: string): string {
  if (!secret) {
    throw new Error("TOTP secret must not be empty");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", resolveKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptTotpSecret(stored: string): string {
  if (!isEncryptedTotpSecret(stored)) {
    throw new Error("Refusing to use an unencrypted TOTP secret");
  }

  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Invalid encrypted TOTP secret envelope");
  }

  const [, , ivPart, tagPart, ciphertextPart] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    resolveKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
