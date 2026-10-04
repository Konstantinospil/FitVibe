import { db } from "../../db/index.js";
import type { Knex } from "knex";

export interface Pending2FASession {
  id: string;
  user_id: string;
  identifier?: string | null;
  created_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  verified: boolean;
  failed_attempts?: number;
  last_failed_at?: string | null;
}

interface CreatePending2FASessionInput {
  id: string;
  user_id: string;
  identifier?: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
}

export async function createPending2FASession(
  input: CreatePending2FASessionInput,
  trx?: Knex.Transaction,
): Promise<Pending2FASession> {
  const conn = trx ?? db;
  const row: Record<string, unknown> = {
    id: input.id,
    user_id: input.user_id,
    expires_at: input.expires_at,
    ip: input.ip,
    user_agent: input.user_agent,
    verified: false,
  };
  if (input.identifier !== undefined) {
    row.identifier = input.identifier;
  }

  const [session] = await conn<Pending2FASession>("pending_2fa_sessions")
    .insert(row)
    .returning("*");
  if (!session) {
    throw new Error("Failed to create pending 2FA session");
  }
  return session;
}

export async function getPending2FASession(
  sessionId: string,
  trx?: Knex.Transaction,
): Promise<Pending2FASession | null> {
  const conn = trx ?? db;
  const session = await conn<Pending2FASession>("pending_2fa_sessions")
    .where({ id: sessionId })
    .first();
  return session ?? null;
}

export async function incrementPending2FAFailures(
  sessionId: string,
  trx?: Knex.Transaction,
): Promise<Pending2FASession | null> {
  const conn = trx ?? db;
  const now = new Date().toISOString();
  const [session] = await conn<Pending2FASession>("pending_2fa_sessions")
    .where({ id: sessionId, verified: false })
    .where("failed_attempts", "<", 3)
    .increment("failed_attempts", 1)
    .update({ last_failed_at: now })
    .returning("*");
  return session ?? null;
}

export async function claimPending2FASessionVerified(
  sessionId: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const rows = await (trx ?? db)("pending_2fa_sessions")
    .where({ id: sessionId, verified: false })
    .where("failed_attempts", "<", 3)
    .update({ verified: true })
    .returning("id");
  return rows.length === 1;
}

export async function hasRecentSecondFactorThrottle(
  userId: string,
  ip: string | null,
  since: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const row = await (trx ?? db)<Pending2FASession>("pending_2fa_sessions")
    .where({ user_id: userId, ip, verified: false })
    .where("failed_attempts", ">=", 3)
    .where("last_failed_at", ">=", since)
    .first("id");
  return Boolean(row);
}

export async function markPending2FASessionVerified(
  sessionId: string,
  trx?: Knex.Transaction,
): Promise<void> {
  await (trx ?? db)("pending_2fa_sessions").where({ id: sessionId }).update({ verified: true });
}

export async function deletePending2FASession(
  sessionId: string,
  trx?: Knex.Transaction,
): Promise<void> {
  await (trx ?? db)("pending_2fa_sessions").where({ id: sessionId }).del();
}

export async function deleteExpiredPending2FASessions(trx?: Knex.Transaction): Promise<number> {
  return (trx ?? db)("pending_2fa_sessions")
    .where("expires_at", "<", new Date().toISOString())
    .del();
}
