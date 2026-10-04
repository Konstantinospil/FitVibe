import crypto from "crypto";
import type { Knex } from "knex";
import { db } from "../../db/index.js";

const TABLE = "failed_login_attempts";
const IP_TABLE = "failed_login_attempts_by_ip";
const ACCOUNT_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
const IP_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

export interface FailedLoginAttempt {
  id: string;
  identifier: string;
  ip_address: string;
  user_agent: string | null;
  attempt_count: number;
  locked_until: string | null;
  last_attempt_at: string;
  first_attempt_at: string;
  created_at: string;
  updated_at: string;
}

export interface FailedLoginAttemptByIP {
  id: string;
  ip_address: string;
  distinct_email_count: number;
  total_attempt_count: number;
  locked_until: string | null;
  last_attempt_at: string;
  first_attempt_at: string;
  created_at: string;
  updated_at: string;
}

interface FailedLoginRow {
  id: string;
  identifier: string;
  ip_address: string;
  user_agent: string | null;
  attempt_count: number | string;
  locked_until: Date | string | null;
  last_attempt_at: Date | string;
  first_attempt_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FailedLoginByIPRow {
  id: string;
  ip_address: string;
  distinct_email_count: number | string;
  total_attempt_count: number | string;
  locked_until: Date | string | null;
  last_attempt_at: Date | string;
  first_attempt_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

function toIsoString(value: unknown): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date(value as number).toISOString();
}

function toRecord(row: FailedLoginRow): FailedLoginAttempt {
  return {
    id: row.id,
    identifier: row.identifier,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    attempt_count: Number(row.attempt_count),
    locked_until: row.locked_until ? toIsoString(row.locked_until) : null,
    last_attempt_at: toIsoString(row.last_attempt_at),
    first_attempt_at: toIsoString(row.first_attempt_at),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

/**
 * Get failed login attempt record for identifier + IP combination
 */
export async function getFailedAttempt(
  identifier: string,
  ipAddress: string,
  trx?: Knex.Transaction,
): Promise<FailedLoginAttempt | null> {
  const exec = withDb(trx);
  const normalizedIdentifier = identifier.toLowerCase().trim();

  const row = await exec<FailedLoginRow>(TABLE)
    .where({ identifier: normalizedIdentifier, ip_address: ipAddress })
    .first();

  return row ? toRecord(row) : null;
}

/**
 * Record a failed login attempt
 * Returns the updated attempt record with new count and potential lockout
 */
export async function recordFailedAttempt(
  identifier: string,
  ipAddress: string,
  userAgent: string | null,
  trx?: Knex.Transaction,
): Promise<FailedLoginAttempt> {
  const exec = withDb(trx);
  const normalizedIdentifier = identifier.toLowerCase().trim();
  const now = new Date().toISOString();

  // Check if record exists. Old failure history decays so an account does not
  // remain permanently one attempt away from a long throttle.
  const existing = await getFailedAttempt(normalizedIdentifier, ipAddress, trx);

  if (existing) {
    const lastAttemptAt = new Date(existing.last_attempt_at).getTime();
    const windowExpired = Date.now() - lastAttemptAt >= ACCOUNT_ATTEMPT_WINDOW_MS;
    const newAttemptCount = windowExpired ? 1 : existing.attempt_count + 1;
    const lockedUntil = calculateLockoutDuration(newAttemptCount);

    // Update existing record
    await exec(TABLE)
      .where({ id: existing.id })
      .update({
        attempt_count: newAttemptCount,
        locked_until: lockedUntil,
        first_attempt_at: windowExpired ? now : existing.first_attempt_at,
        last_attempt_at: now,
        updated_at: now,
      });

    const updated = await getFailedAttempt(normalizedIdentifier, ipAddress, trx);
    if (!updated) {
      throw new Error("Failed login attempt disappeared immediately after update");
    }
    return updated;
  }

  // Create new record
  const id = crypto.randomUUID();
  const lockedUntil = calculateLockoutDuration(1);

  await exec(TABLE).insert({
    id,
    identifier: normalizedIdentifier,
    ip_address: ipAddress,
    user_agent: userAgent,
    attempt_count: 1,
    locked_until: lockedUntil,
    last_attempt_at: now,
    first_attempt_at: now,
    created_at: now,
    updated_at: now,
  });

  return {
    id,
    identifier: normalizedIdentifier,
    ip_address: ipAddress,
    user_agent: userAgent,
    attempt_count: 1,
    locked_until: lockedUntil,
    last_attempt_at: now,
    first_attempt_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Reset failed attempts on successful login
 */
export async function resetFailedAttempts(
  identifier: string,
  ipAddress: string,
  trx?: Knex.Transaction,
): Promise<void> {
  const exec = withDb(trx);
  const normalizedIdentifier = identifier.toLowerCase().trim();

  await exec(TABLE).where({ identifier: normalizedIdentifier, ip_address: ipAddress }).del();
}

/**
 * Calculate lockout duration based on failed attempt count
 * Progressive lockout strategy:
 * - 1-4 attempts: No lockout
 * - 5-9 attempts: 15 minutes
 * - 10-19 attempts: 1 hour
 * - 20+ attempts: 24 hours
 */
function calculateLockoutDuration(attemptCount: number): string | null {
  if (attemptCount < 5) {
    return null; // No lockout yet
  }

  const now = new Date();

  if (attemptCount < 10) {
    // 15 minute lockout
    now.setMinutes(now.getMinutes() + 15);
  } else if (attemptCount < 20) {
    // 1 hour lockout
    now.setHours(now.getHours() + 1);
  } else {
    // 24 hour lockout
    now.setHours(now.getHours() + 24);
  }

  return now.toISOString();
}

/**
 * Get maximum attempts before account-level lockout
 */
export function getMaxAccountAttempts(): number {
  return 5; // Lockout starts at 5 attempts
}

/**
 * Get remaining attempts before account-level lockout
 */
export function getRemainingAccountAttempts(attempt: FailedLoginAttempt | null): number {
  if (!attempt) {
    return getMaxAccountAttempts();
  }
  const maxAttempts = getMaxAccountAttempts();
  return Math.max(0, maxAttempts - attempt.attempt_count);
}

/**
 * Check if account is currently locked
 * Returns true if locked, false if not locked or lockout expired
 */
export function isAccountLocked(attempt: FailedLoginAttempt | null): boolean {
  if (!attempt || !attempt.locked_until) {
    return false;
  }

  const now = new Date();
  const lockoutExpiry = new Date(attempt.locked_until);

  return now < lockoutExpiry;
}

/**
 * Get remaining lockout time in seconds
 */
export function getRemainingLockoutSeconds(attempt: FailedLoginAttempt | null): number {
  if (!attempt || !attempt.locked_until) {
    return 0;
  }

  const now = new Date();
  const lockoutExpiry = new Date(attempt.locked_until);

  if (now >= lockoutExpiry) {
    return 0;
  }

  return Math.ceil((lockoutExpiry.getTime() - now.getTime()) / 1000);
}

/**
 * Cleanup old failed attempt records (older than 30 days)
 * Should be run periodically via cron job
 */
export async function cleanupOldAttempts(trx?: Knex.Transaction): Promise<number> {
  const exec = withDb(trx);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const deleted = await exec(TABLE).where("last_attempt_at", "<", cutoff.toISOString()).del();

  return deleted;
}

// ========================================================================
// IP-Based Brute Force Protection Functions
// ========================================================================

function toIPRecord(row: FailedLoginByIPRow): FailedLoginAttemptByIP {
  return {
    id: row.id,
    ip_address: row.ip_address,
    distinct_email_count: Number(row.distinct_email_count),
    total_attempt_count: Number(row.total_attempt_count),
    locked_until: row.locked_until ? toIsoString(row.locked_until) : null,
    last_attempt_at: toIsoString(row.last_attempt_at),
    first_attempt_at: toIsoString(row.first_attempt_at),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

/**
 * Get failed login attempt record for IP address
 */
export async function getFailedAttemptByIP(
  ipAddress: string,
  trx?: Knex.Transaction,
): Promise<FailedLoginAttemptByIP | null> {
  const exec = withDb(trx);

  const row = await exec<FailedLoginByIPRow>(IP_TABLE).where({ ip_address: ipAddress }).first();

  return row ? toIPRecord(row) : null;
}

/**
 * Record a failed login attempt by IP address
 * Tracks both total attempts and distinct email addresses attempted
 * Returns the updated attempt record with new count and potential lockout
 */
export async function recordFailedAttemptByIP(
  ipAddress: string,
  identifier: string,
  trx?: Knex.Transaction,
): Promise<FailedLoginAttemptByIP> {
  const exec = withDb(trx);
  const normalizedIdentifier = identifier.toLowerCase().trim();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const windowStart = new Date(nowDate.getTime() - IP_ATTEMPT_WINDOW_MS).toISOString();

  const existingRow = await exec<FailedLoginByIPRow>(IP_TABLE)
    .where({ ip_address: ipAddress })
    .first();
  let existing = existingRow ? toIPRecord(existingRow) : null;

  if (existing && new Date(existing.last_attempt_at) < new Date(windowStart)) {
    await exec(IP_TABLE).where({ id: existing.id }).update({
      distinct_email_count: 0,
      total_attempt_count: 0,
      locked_until: null,
      first_attempt_at: now,
      last_attempt_at: now,
      updated_at: now,
    });
    existing = {
      ...existing,
      distinct_email_count: 0,
      total_attempt_count: 0,
      locked_until: null,
      first_attempt_at: now,
      last_attempt_at: now,
      updated_at: now,
    };
  }

  if (existing) {
    // Count distinct identifiers for this IP in the failed_login_attempts table
    // This is the source of truth for how many distinct emails have been attempted from this IP
    // Since recordFailedAttempt may have already created a record in the same transaction,
    // we count from the database to get the accurate current count
    const distinctCountResult = await exec(TABLE)
      .where({ ip_address: ipAddress })
      .where("last_attempt_at", ">=", windowStart)
      .countDistinct("identifier as count")
      .first<{ count: string | number }>();

    const actualDistinctCount = distinctCountResult ? Number(distinctCountResult.count) : 0;

    // Use the actual distinct count from the database as the source of truth
    // This ensures we always have the correct count, even if records were created
    // in a different order or in the same transaction
    const newDistinctEmailCount = Math.max(actualDistinctCount, existing.distinct_email_count);

    // Calculate new counts
    const newTotalAttemptCount = existing.total_attempt_count + 1;

    // Calculate new lockout duration
    const newLockedUntil = calculateIPLockoutDuration(newTotalAttemptCount, newDistinctEmailCount);

    // Only update locked_until if:
    // 1. Not currently locked, OR
    // 2. New lockout is longer than existing lockout (progressive escalation)
    // This prevents overwriting longer lockouts with shorter ones
    let finalLockedUntil = newLockedUntil;
    if (existing.locked_until) {
      const now = new Date();
      const existingLockout = new Date(existing.locked_until);
      // Check if currently locked (lockout hasn't expired)
      if (now < existingLockout) {
        const newLockout = newLockedUntil ? new Date(newLockedUntil) : null;
        // Keep existing lockout if it's longer than the new one
        if (newLockout && existingLockout > newLockout) {
          finalLockedUntil = existing.locked_until;
        }
      }
    }

    // Update existing record
    await exec(IP_TABLE).where({ id: existing.id }).update({
      distinct_email_count: newDistinctEmailCount,
      total_attempt_count: newTotalAttemptCount,
      locked_until: finalLockedUntil,
      last_attempt_at: now,
      updated_at: now,
    });

    const updated = await getFailedAttemptByIP(ipAddress, trx);
    if (!updated) {
      throw new Error("IP login-attempt aggregate disappeared immediately after update");
    }
    return updated;
  }

  // Create new record
  const id = crypto.randomUUID();
  const lockedUntil = calculateIPLockoutDuration(1, 1);

  // Create record in failed_login_attempts for tracking distinct emails
  // This ensures subsequent calls can correctly identify this email as existing
  try {
    const accountAttemptId = crypto.randomUUID();
    await exec(TABLE)
      .insert({
        id: accountAttemptId,
        identifier: normalizedIdentifier,
        ip_address: ipAddress,
        user_agent: null,
        attempt_count: 1,
        locked_until: null,
        last_attempt_at: now,
        first_attempt_at: now,
        created_at: now,
        updated_at: now,
      })
      .onConflict(["identifier", "ip_address"])
      .ignore();
  } catch (error) {
    // If insert fails, that's OK - continue with IP record creation
    // This can happen if recordFailedAttempt was called first
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("unique") && !errorMessage.includes("duplicate")) {
      throw error;
    }
  }

  await exec(IP_TABLE).insert({
    id,
    ip_address: ipAddress,
    distinct_email_count: 1,
    total_attempt_count: 1,
    locked_until: lockedUntil,
    last_attempt_at: now,
    first_attempt_at: now,
    created_at: now,
    updated_at: now,
  });

  return {
    id,
    ip_address: ipAddress,
    distinct_email_count: 1,
    total_attempt_count: 1,
    locked_until: lockedUntil,
    last_attempt_at: now,
    first_attempt_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Calculate lockout duration for IP-based attempts
 * More aggressive strategy since this targets cross-email enumeration attacks:
 * - 1-9 attempts: No lockout
 * - 10-19 attempts OR 5+ distinct emails: 30 minutes
 * - 20-49 attempts OR 10+ distinct emails: 2 hours
 * - 50+ attempts OR 20+ distinct emails: 24 hours
 */
function calculateIPLockoutDuration(
  totalAttemptCount: number,
  distinctEmailCount: number,
): string | null {
  if (totalAttemptCount < 10 && distinctEmailCount < 5) {
    return null; // No lockout yet
  }

  const now = new Date();

  // Trigger lockout if either threshold is met
  if (totalAttemptCount >= 50 || distinctEmailCount >= 20) {
    // 24 hour lockout
    now.setHours(now.getHours() + 24);
  } else if (totalAttemptCount >= 20 || distinctEmailCount >= 10) {
    // 2 hour lockout
    now.setHours(now.getHours() + 2);
  } else {
    // 30 minute lockout
    now.setMinutes(now.getMinutes() + 30);
  }

  return now.toISOString();
}

/**
 * Get maximum attempts before IP-level lockout (by total attempts)
 */
export function getMaxIPAttempts(): number {
  return 10; // Lockout starts at 10 attempts
}

/**
 * Get maximum distinct emails before IP-level lockout
 */
export function getMaxIPDistinctEmails(): number {
  return 5; // Lockout starts at 5 distinct emails
}

/**
 * Get remaining attempts before IP-level lockout
 * Returns the minimum of remaining attempts or remaining distinct emails
 */
export function getRemainingIPAttempts(attempt: FailedLoginAttemptByIP | null): {
  remainingAttempts: number;
  remainingDistinctEmails: number;
} {
  if (!attempt) {
    return {
      remainingAttempts: getMaxIPAttempts(),
      remainingDistinctEmails: getMaxIPDistinctEmails(),
    };
  }

  const maxAttempts = getMaxIPAttempts();
  const maxDistinctEmails = getMaxIPDistinctEmails();

  return {
    remainingAttempts: Math.max(0, maxAttempts - attempt.total_attempt_count),
    remainingDistinctEmails: Math.max(0, maxDistinctEmails - attempt.distinct_email_count),
  };
}

/**
 * Check if IP address is currently locked
 * Returns true if locked, false if not locked or lockout expired
 */
export function isIPLocked(attempt: FailedLoginAttemptByIP | null): boolean {
  if (!attempt || !attempt.locked_until) {
    return false;
  }

  const now = new Date();
  const lockoutExpiry = new Date(attempt.locked_until);

  return now < lockoutExpiry;
}

/**
 * Get remaining lockout time in seconds for IP
 */
export function getRemainingIPLockoutSeconds(attempt: FailedLoginAttemptByIP | null): number {
  if (!attempt || !attempt.locked_until) {
    return 0;
  }

  const now = new Date();
  const lockoutExpiry = new Date(attempt.locked_until);

  if (now >= lockoutExpiry) {
    return 0;
  }

  return Math.ceil((lockoutExpiry.getTime() - now.getTime()) / 1000);
}

/**
 * Reset failed attempts by IP on successful login
 * Note: This only resets if the successful login is from the same IP
 */
export async function resetFailedAttemptsByIP(
  ipAddress: string,
  trx?: Knex.Transaction,
): Promise<void> {
  const exec = withDb(trx);

  await exec(IP_TABLE).where({ ip_address: ipAddress }).del();
}

/**
 * Cleanup old IP-based failed attempt records (older than 30 days)
 * Should be run periodically via cron job
 */
export async function cleanupOldIPAttempts(trx?: Knex.Transaction): Promise<number> {
  const exec = withDb(trx);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const deleted = await exec(IP_TABLE).where("last_attempt_at", "<", cutoff.toISOString()).del();

  return deleted;
}

/**
 * Serialize failed-password updates per source IP inside the caller transaction.
 * This prevents lost increments and inconsistent distinct-identifier counts.
 */
export async function lockLoginAttemptIp(ipAddress: string, trx: Knex.Transaction): Promise<void> {
  await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [`fitvibe-auth:${ipAddress}`]);
}
