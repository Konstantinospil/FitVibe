import type { Knex } from "knex";

import { db } from "../db/connection.js";
import { processDueAccountDeletions } from "../modules/users/dsr.service.js";
import { purgeExpiredRegistrationIntents } from "../modules/auth/auth.registration-intent.repository.js";

export interface RetentionSummary {
  purgedIdempotencyKeys: number;
  purgedAuthTokens: number;
  purgedRefreshTokens: number;
  purgedUnverifiedAccounts: number;
  purgedRegistrationIntents: number;
  processedDsrRequests: number;
}

function iso(date: Date): string {
  return date.toISOString();
}

export async function purgeStaleIdempotencyKeys(now: Date = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return db("idempotency_keys").where("created_at", "<", iso(threshold)).del();
}

export async function purgeExpiredAuthTokens(now: Date = new Date()): Promise<number> {
  return db("auth_tokens").where("expires_at", "<", iso(now)).del();
}

export async function purgeExpiredRefreshTokens(now: Date = new Date()): Promise<number> {
  const revokedThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return db("refresh_tokens")
    .where("expires_at", "<", iso(now))
    .orWhere(function expiredRevoked(this: Knex.QueryBuilder) {
      this.whereNotNull("revoked_at").andWhere("revoked_at", "<", iso(revokedThreshold));
    })
    .del();
}

/**
 * Purge unverified accounts older than 7 days (AC-1.8)
 *
 * This function:
 * 1. Finds all users with status='pending_verification'
 * 2. Created more than 7 days ago
 * 3. Hard deletes them from the database
 * 4. Cascading foreign keys will clean up related records (profiles, auth_tokens, etc.)
 *
 * @param now - Current date/time (for testing)
 * @returns Number of accounts purged
 */
export async function purgeUnverifiedAccounts(now: Date = new Date()): Promise<number> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const deleted = await db("users")
    .where("status", "pending_verification")
    .andWhere("created_at", "<", iso(sevenDaysAgo))
    .del();
  return deleted;
}

export async function runRetentionSweep(now: Date = new Date()): Promise<RetentionSummary> {
  const purgedIdempotencyKeys = await purgeStaleIdempotencyKeys(now);
  const purgedAuthTokens = await purgeExpiredAuthTokens(now);
  const purgedRefreshTokens = await purgeExpiredRefreshTokens(now);
  const purgedUnverifiedAccounts = await purgeUnverifiedAccounts(now);
  const purgedRegistrationIntents = await purgeExpiredRegistrationIntents(now);
  const processedDsrRequests = await processDueAccountDeletions(now);

  return {
    purgedIdempotencyKeys,
    purgedAuthTokens,
    purgedRefreshTokens,
    purgedUnverifiedAccounts,
    purgedRegistrationIntents,
    processedDsrRequests,
  };
}
