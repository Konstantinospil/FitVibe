import crypto from "crypto";
import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import type { Knex } from "knex";
import { HttpError } from "../../utils/http.js";
import { decryptTotpSecret, encryptTotpSecret } from "./totp-secret.crypto.js";
import { env } from "../../config/env.js";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";

const TOTP_CODE_PATTERN = new RegExp(`^\\d{${AUTH_SECURITY_POLICY.totp.digits}}$`);

// Configure TOTP settings
authenticator.options = {
  window: AUTH_SECURITY_POLICY.totp.windowSteps,
  step: AUTH_SECURITY_POLICY.totp.stepSeconds,
};

interface User2FASettings {
  id: string;
  user_id: string;
  totp_secret: string;
  is_enabled: boolean;
  is_verified: boolean;
  recovery_email: string | null;
  recovery_phone: string | null;
  enabled_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackupCode {
  id: string;
  user_id: string;
  code_hash: string;
  is_used: boolean;
  used_at: string | null;
  generation_batch: number;
  created_at: string;
}

export async function beginTwoFactorSetup(userId: string): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
}> {
  const existing = await db<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId })
    .first();
  if (existing) {
    throw new HttpError(
      409,
      "2FA_SETUP_RESTART_REQUIRES_STEP_UP",
      "Step-up authentication required",
    );
  }

  const email = await db("user_contacts")
    .where({ user_id: userId, type: "email", is_primary: true })
    .first<{ value: string }>("value");

  if (!email?.value) {
    throw new HttpError(404, "E.USER.EMAIL_NOT_FOUND", "Primary email not found");
  }

  return db.transaction((trx) => setupTwoFactor(userId, email.value, trx));
}

export async function restartTwoFactorSetup(
  userId: string,
  password: string,
  code?: string,
): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
  const email = await db("user_contacts")
    .where({ user_id: userId, type: "email", is_primary: true })
    .first<{ value: string }>("value");
  if (!email?.value) {
    throw new HttpError(404, "E.USER.EMAIL_NOT_FOUND", "Primary email not found");
  }

  return db.transaction(async (trx) => {
    const settings = await trx<User2FASettings>("user_2fa_settings")
      .where({ user_id: userId })
      .first();
    await assertStepUp(
      userId,
      password,
      code,
      Boolean(settings?.is_enabled && settings?.is_verified),
      trx,
    );
    return setupTwoFactor(userId, email.value, trx, true);
  });
}

export async function enableTwoFactor(userId: string, code: string): Promise<void> {
  await db.transaction(async (trx) => {
    await verifyAndEnable2FA(userId, code, trx);
  });
}

export async function disableTwoFactor(
  userId: string,
  password: string,
  code: string,
): Promise<void> {
  await db.transaction(async (trx) => {
    const user = await trx("users").where({ id: userId }).first<{ role_code: string }>("role_code");
    if (user?.role_code === "superadmin") {
      throw new HttpError(
        409,
        "SUPERADMIN_2FA_REQUIRED",
        "Demote the superadmin account before disabling two-factor authentication",
      );
    }
    await assertStepUp(userId, password, code, true, trx);
    await disable2FA(userId, trx);
  });
}

export async function regenerateTwoFactorBackupCodes(
  userId: string,
  password: string,
  code: string,
): Promise<string[]> {
  return db.transaction(async (trx) => {
    await assertStepUp(userId, password, code, true, trx);
    return regenerateBackupCodes(userId, trx);
  });
}

/**
 * Generate a new TOTP secret for a user
 * Returns the secret and a QR code data URL for easy setup
 */
export async function setupTwoFactor(
  userId: string,
  userEmail: string,
  trx?: Knex.Transaction,
  allowReplace = false,
): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
}> {
  const exec = trx ?? db;

  // Check if user already has 2FA settings
  const existing = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId })
    .first();

  if (existing && existing.is_enabled && !allowReplace) {
    throw new HttpError(400, "2FA_ALREADY_ENABLED", "Two-factor authentication is already enabled");
  }

  // Generate new TOTP secret
  const secret = authenticator.generateSecret();

  // Generate QR code
  const otpauthUrl = authenticator.keyuri(userEmail, env.appName, secret);

  const qrCode: string = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes
  const backupCodes = await generateBackupCodes(userId, 1, trx);

  const now = new Date().toISOString();

  if (existing) {
    // Update existing record
    await exec("user_2fa_settings")
      .where({ id: existing.id })
      .update({
        totp_secret: encryptTotpSecret(secret),
        is_enabled: false,
        is_verified: false,
        updated_at: now,
      });
  } else {
    // Create new record
    await exec("user_2fa_settings").insert({
      id: uuidv4(),
      user_id: userId,
      totp_secret: encryptTotpSecret(secret),
      is_enabled: false,
      is_verified: false,
      recovery_email: null,
      recovery_phone: null,
      enabled_at: null,
      last_used_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify TOTP code and enable 2FA for the user
 */
export async function verifyAndEnable2FA(
  userId: string,
  code: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const exec = trx ?? db;

  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId })
    .first();

  if (!settings) {
    throw new HttpError(404, "2FA_NOT_SETUP", "Two-factor authentication has not been set up");
  }

  if (settings.is_enabled && settings.is_verified) {
    throw new HttpError(400, "2FA_ALREADY_ENABLED", "Two-factor authentication is already enabled");
  }

  // Verify the TOTP code
  const isValid: boolean = authenticator.verify({
    token: code,
    secret: decryptTotpSecret(settings.totp_secret),
  });

  if (!isValid) {
    throw new HttpError(401, "INVALID_2FA_CODE", "Invalid verification code");
  }

  // Enable 2FA
  const now = new Date().toISOString();
  await exec("user_2fa_settings").where({ id: settings.id }).update({
    is_enabled: true,
    is_verified: true,
    enabled_at: now,
    last_used_at: now,
    updated_at: now,
  });

  // Audit log
  await exec("audit_log").insert({
    id: uuidv4(),
    actor_user_id: userId,
    action: "2fa_enabled",
    entity_type: "auth",
    metadata: {},
    created_at: now,
  });

  return true;
}

export async function verifyTotpOnly(
  userId: string,
  code: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  if (!TOTP_CODE_PATTERN.test(code)) {
    return false;
  }

  const exec = trx ?? db;
  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId, is_enabled: true, is_verified: true })
    .first();

  if (!settings) {
    return false;
  }

  return authenticator.verify({
    token: code,
    secret: decryptTotpSecret(settings.totp_secret),
  });
}

/**
 * Verify a TOTP code during login
 */
export async function verify2FACode(
  userId: string,
  code: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const exec = trx ?? db;

  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId, is_enabled: true, is_verified: true })
    .first();

  if (!settings || !settings.is_enabled || !settings.is_verified) {
    return false;
  }

  // Try TOTP code first
  const isValidTOTP = authenticator.verify({
    token: code,
    secret: decryptTotpSecret(settings.totp_secret),
  });

  if (isValidTOTP) {
    // Update last used timestamp
    await exec("user_2fa_settings").where({ id: settings.id }).update({
      last_used_at: new Date().toISOString(),
    });
    return true;
  }

  // A numeric TOTP cannot match the human-readable backup-code format.
  // Avoid unnecessary bcrypt scans and keep invalid-TOTP timing predictable.
  if (TOTP_CODE_PATTERN.test(code)) {
    return false;
  }

  // Try backup codes
  const isValidBackup = await verifyBackupCode(userId, code, trx);
  if (isValidBackup) {
    return true;
  }

  return false;
}

/**
 * Disable 2FA after step-up has already succeeded.
 */
export async function disable2FA(userId: string, trx?: Knex.Transaction): Promise<boolean> {
  const exec = trx ?? db;
  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId })
    .first();

  if (!settings || !settings.is_enabled) {
    throw new HttpError(404, "2FA_NOT_ENABLED", "Two-factor authentication is not enabled");
  }

  const now = new Date().toISOString();
  await exec("user_2fa_settings").where({ id: settings.id }).update({
    // Keep the encrypted secret at rest while disabling. An empty string would
    // bypass the encryption-at-rest invariant and is unnecessary because the
    // enabled/verified flags make the secret unusable.
    is_enabled: false,
    is_verified: false,
    enabled_at: null,
    last_used_at: null,
    updated_at: now,
  });

  await exec("backup_codes").where({ user_id: userId }).del();

  await exec("audit_log").insert({
    id: uuidv4(),
    actor_user_id: userId,
    action: "2fa_disabled",
    entity_type: "auth",
    metadata: {},
    created_at: now,
  });

  return true;
}

async function assertStepUp(
  userId: string,
  password: string,
  code: string | undefined,
  requireSecondFactor: boolean,
  trx: Knex.Transaction,
): Promise<void> {
  const user = await trx("users")
    .where({ id: userId })
    .first<{ password_hash: string }>("password_hash");
  if (!user) {
    throw new HttpError(404, "E.USER.NOT_FOUND", "User not found");
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw new HttpError(401, "STEP_UP_FAILED", "Step-up authentication failed");
  }

  if (requireSecondFactor) {
    if (!code || !(await verify2FACode(userId, code, trx))) {
      throw new HttpError(401, "STEP_UP_FAILED", "Step-up authentication failed");
    }
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string, trx?: Knex.Transaction): Promise<boolean> {
  const exec = trx ?? db;

  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId, is_enabled: true })
    .first();

  return Boolean(settings?.is_enabled && settings?.is_verified);
}

/**
 * Generate new backup codes (invalidates old ones from same batch)
 */
export async function generateBackupCodes(
  userId: string,
  batch: number,
  trx?: Knex.Transaction,
): Promise<string[]> {
  const exec = trx ?? db;
  const codes: string[] = [];
  const now = new Date().toISOString();

  // Delete old codes from this batch
  await exec("backup_codes").where({ user_id: userId, generation_batch: batch }).del();

  // Generate new codes
  for (let i = 0; i < AUTH_SECURITY_POLICY.backupCodes.count; i++) {
    const code = generateBackupCode();
    const codeHash = await bcrypt.hash(code, AUTH_SECURITY_POLICY.backupCodes.hashCost);

    await exec("backup_codes").insert({
      id: uuidv4(),
      user_id: userId,
      code_hash: codeHash,
      is_used: false,
      used_at: null,
      generation_batch: batch,
      created_at: now,
    });

    codes.push(code);
  }

  // Audit log
  await exec("audit_log").insert({
    id: uuidv4(),
    actor_user_id: userId,
    action: "2fa_backup_codes_generated",
    entity_type: "auth",
    metadata: { batch, count: AUTH_SECURITY_POLICY.backupCodes.count },
    created_at: now,
  });

  return codes;
}

/**
 * Verify and consume a backup code
 */
async function verifyBackupCode(
  userId: string,
  code: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const exec = trx ?? db;

  // Get all unused backup codes for this user
  const backupCodes = await exec<BackupCode>("backup_codes").where({
    user_id: userId,
    is_used: false,
  });

  for (const storedCode of backupCodes) {
    const isValid = await bcrypt.compare(code, storedCode.code_hash);
    if (isValid) {
      const consumed = await exec("backup_codes")
        .where({ id: storedCode.id, is_used: false })
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        });

      if (consumed > 0) {
        await exec("user_2fa_settings").where({ user_id: userId }).update({
          last_used_at: new Date().toISOString(),
        });
        return true;
      }
    }
  }

  return false;
}

/**
 * Get remaining backup codes count
 */
export async function getRemainingBackupCodesCount(
  userId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = trx ?? db;

  const result = await exec("backup_codes")
    .where({ user_id: userId, is_used: false })
    .count<{ count: string | number }>("* as count")
    .first();

  return Number(result?.count ?? 0);
}

export async function getTwoFactorStatus(
  userId: string,
  trx?: Knex.Transaction,
): Promise<{ enabled: boolean; enabledAt: string | null; backupCodesRemaining: number }> {
  const exec = trx ?? db;
  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId })
    .first();

  if (!settings || !settings.is_enabled || !settings.is_verified) {
    return {
      enabled: false,
      enabledAt: null,
      backupCodesRemaining: 0,
    };
  }

  return {
    enabled: true,
    enabledAt: settings.enabled_at,
    backupCodesRemaining: await getRemainingBackupCodesCount(userId, trx),
  };
}

export async function regenerateBackupCodes(
  userId: string,
  trx?: Knex.Transaction,
): Promise<string[]> {
  const exec = trx ?? db;
  const settings = await exec<User2FASettings>("user_2fa_settings")
    .where({ user_id: userId, is_enabled: true })
    .first();

  if (!settings) {
    throw new HttpError(404, "2FA_NOT_ENABLED", "Two-factor authentication is not enabled");
  }

  const latestBatch = await exec("backup_codes")
    .where({ user_id: userId })
    .max<{ max: string | number | null }>("generation_batch as max")
    .first();

  const nextBatch = Number(latestBatch?.max ?? 0) + 1;
  await exec("backup_codes").where({ user_id: userId }).del();
  return generateBackupCodes(userId, nextBatch, trx);
}

/**
 * Generate a human-readable backup code
 * Format: XXXX-XXXX (8 alphanumeric characters with dash)
 */
function generateBackupCode(): string {
  const chars = AUTH_SECURITY_POLICY.backupCodes.alphabet;
  let code = "";

  for (let i = 0; i < AUTH_SECURITY_POLICY.backupCodes.length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];

    // Add dash in the middle
    if (i === AUTH_SECURITY_POLICY.backupCodes.length / 2 - 1) {
      code += "-";
    }
  }

  return code;
}
