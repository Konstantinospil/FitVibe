import type { Knex } from "knex";
import { db } from "../../db/connection.js";

export interface SessionInsert {
  jti: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
}

export interface RefreshInsert {
  id: string;
  user_id: string;
  token_hash: string;
  session_jti: string;
  expires_at: string;
  created_at: string;
}

export async function createSessionWithRefresh(
  session: SessionInsert,
  refresh: RefreshInsert,
): Promise<void> {
  await db.transaction(async (trx) => {
    await trx("auth_sessions").insert(session);
    await trx("refresh_tokens").insert(refresh);
  });
}

export async function rotateRefreshAtomic(
  oldTokenHash: string,
  sessionJti: string,
  replacement: RefreshInsert,
  sessionPatch: { expires_at: string; user_agent?: string | null; ip?: string | null },
): Promise<boolean> {
  return db.transaction(async (trx) => {
    const current = await trx<{ revoked_at: string | null }>("refresh_tokens")
      .where({ token_hash: oldTokenHash, session_jti: sessionJti })
      .forUpdate()
      .first("revoked_at");

    if (!current || current.revoked_at) {
      return false;
    }

    const now = new Date().toISOString();
    await trx("refresh_tokens").where({ token_hash: oldTokenHash }).update({ revoked_at: now });
    await trx("refresh_tokens").insert(replacement);
    const updated = await trx("auth_sessions")
      .where({ jti: sessionJti })
      .whereNull("revoked_at")
      .update(sessionPatch);

    if (updated !== 1) {
      throw new Error("AUTH_SESSION_ROTATION_FAILED");
    }
    return true;
  });
}

export async function revokeSessionFamilyAtomic(sessionJti: string): Promise<void> {
  await db.transaction(async (trx) => {
    const now = new Date().toISOString();
    await trx("refresh_tokens").where({ session_jti: sessionJti }).whereNull("revoked_at").update({
      revoked_at: now,
    });
    await trx("auth_sessions").where({ jti: sessionJti }).whereNull("revoked_at").update({
      revoked_at: now,
    });
  });
}

export async function revokeUserAuthStateAtomic(
  userId: string,
  trx?: Knex.Transaction,
): Promise<void> {
  const work = async (transaction: Knex.Transaction): Promise<void> => {
    const now = new Date().toISOString();
    await transaction("refresh_tokens").where({ user_id: userId }).whereNull("revoked_at").update({
      revoked_at: now,
    });
    await transaction("auth_sessions").where({ user_id: userId }).whereNull("revoked_at").update({
      revoked_at: now,
    });
  };

  if (trx) {
    await work(trx);
    return;
  }
  await db.transaction(work);
}

export async function changePasswordAndRevokeAuthAtomic(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.transaction(async (trx) => {
    await trx("users").where({ id: userId }).update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    });
    await revokeUserAuthStateAtomic(userId, trx);
  });
}

export async function resetPasswordAtomic(
  userId: string,
  passwordHash: string,
  resetTokenId: string,
  resetTokenType: string,
): Promise<boolean> {
  return db.transaction(async (trx) => {
    const token = await trx<{ id: string }>("auth_tokens")
      .where({ id: resetTokenId, user_id: userId, token_type: resetTokenType })
      .whereNull("consumed_at")
      .forUpdate()
      .first("id");

    if (!token) {
      return false;
    }

    const now = new Date().toISOString();
    await trx("users").where({ id: userId }).update({
      password_hash: passwordHash,
      updated_at: now,
    });
    await trx("auth_tokens")
      .where({ user_id: userId, token_type: resetTokenType })
      .whereNull("consumed_at")
      .update({ consumed_at: now });
    await revokeUserAuthStateAtomic(userId, trx);
    return true;
  });
}

export async function isSessionActiveForUser(sessionJti: string, userId: string): Promise<boolean> {
  const row = await db<{ jti: string }>("auth_sessions")
    .where({ jti: sessionJti, user_id: userId })
    .whereNull("revoked_at")
    .andWhere("expires_at", ">", new Date().toISOString())
    .first("jti");
  return Boolean(row);
}
