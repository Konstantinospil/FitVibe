import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../utils/http.js";
import { assertPasswordPolicy } from "./passwordPolicy.js";
import {
  verifyPasswordHash,
  hashPassword,
  isLegacyBcryptHash,
} from "./password-hashing.service.js";

export interface SessionInsert {
  jti: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
}

interface RefreshStateRow {
  token_hash: string;
  session_jti: string;
  revoked_at: string | null;
}

interface ResetTokenStateRow {
  id: string;
  user_id: string;
  token_type: string;
  consumed_at: string | null;
}

interface AuthSessionStateRow {
  jti: string;
  user_id: string;
  revoked_at: string | null;
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
    const current = await trx<RefreshStateRow>("refresh_tokens")
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

/**
 * Password history is updated inside the same transaction as credential
 * replacement and session revocation. Lock the user row to serialize two
 * simultaneous password changes and prevent last-five reuse races.
 */
async function checkAndRecordPasswordHistory(
  trx: Knex.Transaction,
  userId: string,
  candidate: string,
  previousHash: string,
): Promise<void> {
  if (await verifyPasswordHash(candidate, previousHash)) {
    throw new HttpError(400, "PASSWORD_REUSED", "PASSWORD_REUSED");
  }
  const history = await trx("user_password_history")
    .where({ user_id: userId })
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(5)
    .select<{ password_hash: string }[]>("password_hash");
  for (const row of history) {
    if (await verifyPasswordHash(candidate, row.password_hash)) {
      throw new HttpError(400, "PASSWORD_REUSED", "PASSWORD_REUSED");
    }
  }
  await trx("user_password_history").insert({
    id: uuidv4(),
    user_id: userId,
    password_hash: previousHash,
    created_at: new Date().toISOString(),
  });
  const oldIds = await trx("user_password_history")
    .where({ user_id: userId })
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .offset(5)
    .pluck("id");
  if (oldIds.length > 0) {
    await trx("user_password_history").whereIn("id", oldIds).del();
  }
}

export async function upgradeLegacyPasswordHash(
  userId: string,
  oldHash: string,
  password: string,
): Promise<boolean> {
  if (!isLegacyBcryptHash(oldHash)) {
    return false;
  }
  const replacement = await hashPassword(password);
  // Conditional update: a concurrent password change must win over migration.
  const affected = await db("users")
    .where({ id: userId, password_hash: oldHash, status: "active" })
    .update({ password_hash: replacement, updated_at: new Date().toISOString() });
  return affected === 1;
}

export async function changePasswordAndRevokeAuthAtomic(
  userId: string,
  passwordHash: string,
  candidate: string,
  currentPassword: string,
): Promise<void> {
  await db.transaction(async (trx) => {
    const user = await trx("users")
      .where({ id: userId, status: "active" })
      .forUpdate()
      .first<{ password_hash: string; role_code: string }>("password_hash", "role_code");
    if (!user) {
      throw new HttpError(400, "USER_NOT_FOUND", "USER_NOT_FOUND");
    }
    // A role promotion can race with a password change. Recheck the role-specific
    // minimum at the same serialization point as the current password.
    assertPasswordPolicy(candidate, { role: user.role_code });
    // A concurrent change may already have invalidated the password checked
    // before entering this transaction. Only the locked current hash is authoritative.
    if (!(await verifyPasswordHash(currentPassword, user.password_hash))) {
      throw new HttpError(401, "USER_INVALID_PASSWORD", "USER_INVALID_PASSWORD");
    }
    await checkAndRecordPasswordHistory(trx, userId, candidate, user.password_hash);
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
  candidate: string,
): Promise<boolean> {
  return db.transaction(async (trx) => {
    const token = await trx<ResetTokenStateRow>("auth_tokens")
      .where({ id: resetTokenId, user_id: userId, token_type: resetTokenType })
      .whereNull("consumed_at")
      .forUpdate()
      .first("id");

    if (!token) {
      return false;
    }

    const now = new Date().toISOString();
    const user = await trx("users")
      .where({ id: userId, status: "active" })
      .forUpdate()
      .first<{ password_hash: string }>("password_hash");
    if (!user) {
      return false;
    }
    await checkAndRecordPasswordHistory(trx, userId, candidate, user.password_hash);
    const updatedUser = await trx("users").where({ id: userId, status: "active" }).update({
      password_hash: passwordHash,
      updated_at: now,
    });
    if (updatedUser !== 1) {
      // Roll back without consuming the token or modifying any session state.
      return false;
    }
    await trx("auth_tokens")
      .where({ user_id: userId, token_type: resetTokenType })
      .whereNull("consumed_at")
      .update({ consumed_at: now });
    await revokeUserAuthStateAtomic(userId, trx);
    return true;
  });
}

export async function isSessionActiveForUser(sessionJti: string, userId: string): Promise<boolean> {
  const row = await db<AuthSessionStateRow>("auth_sessions")
    .where({ jti: sessionJti, user_id: userId })
    .whereNull("revoked_at")
    .andWhere("expires_at", ">", new Date().toISOString())
    .first("jti");
  return Boolean(row);
}
