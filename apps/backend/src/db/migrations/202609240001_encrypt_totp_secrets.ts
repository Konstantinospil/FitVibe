import crypto from "node:crypto";
import type { Knex } from "knex";

const PREFIX = "enc:v1";
const AAD = Buffer.from("fitvibe:totp:v1", "utf8");

function keyFromEnvironment(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY is required before migrating existing plaintext TOTP secrets",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }
  throw new Error("TOTP_ENCRYPTION_KEY must be a 32-byte key encoded as hex or base64");
}

function encrypt(secret: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export async function up(knex: Knex): Promise<void> {
  const rows = await knex<{ id: string; totp_secret: string }>("user_2fa_settings")
    .select("id", "totp_secret")
    .whereNot("totp_secret", "")
    .whereNot("totp_secret", "like", `${PREFIX}:%`);

  const encryptedSecrets = await knex<{ id: string }>("user_2fa_settings")
    .select("id")
    .where("totp_secret", "like", `${PREFIX}:%`)
    .limit(1);

  if (rows.length === 0 && encryptedSecrets.length === 0) {
    return;
  }

  // The runtime refuses plaintext secrets. Require the key whenever TOTP
  // material exists, including when this migration is replayed after the
  // secrets were already encrypted.
  const key = keyFromEnvironment();

  if (rows.length === 0) {
    return;
  }

  await knex.transaction(async (trx) => {
    for (const row of rows) {
      await trx("user_2fa_settings")
        .where({ id: row.id, totp_secret: row.totp_secret })
        .update({ totp_secret: encrypt(row.totp_secret, key) });
    }
  });
}

export function down(): Promise<void> {
  // Security-preserving rollback: migration bookkeeping may roll back, but
  // encrypted TOTP material is never converted back to plaintext. Reapplying
  // up() is idempotent because enc:v1 envelopes are skipped.
  return Promise.resolve();
}
