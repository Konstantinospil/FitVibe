import { db } from "../../db/connection.js";
import { withUserForeignKeyVisibilityRetry } from "./auth.fk-retry.js";

interface RefreshTokenInsert {
  id: string;
  user_id: string;
  token_hash: string;
  session_jti: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string | null;
}

export interface RefreshTokenRecord extends RefreshTokenInsert {
  revoked_at: string | null;
}

export async function insertRefreshToken(row: RefreshTokenInsert): Promise<RefreshTokenRecord[]> {
  return withUserForeignKeyVisibilityRetry("refresh_tokens", () =>
    db<RefreshTokenRecord>("refresh_tokens").insert(row).returning("*"),
  );
}

export async function revokeRefreshByHash(token_hash: string) {
  return db("refresh_tokens")
    .where({ token_hash })
    .update({ revoked_at: new Date().toISOString() });
}

export async function getRefreshByHash(
  token_hash: string,
): Promise<RefreshTokenRecord | undefined> {
  return db<RefreshTokenRecord>("refresh_tokens")
    .where({ token_hash })
    .whereNull("revoked_at")
    .first();
}

export async function revokeRefreshByUserId(user_id: string) {
  return db("refresh_tokens").where({ user_id }).update({ revoked_at: new Date().toISOString() });
}

export async function revokeRefreshBySession(session_jti: string) {
  return db("refresh_tokens")
    .where({ session_jti })
    .update({ revoked_at: new Date().toISOString() });
}

export async function revokeRefreshByUserExceptSession(user_id: string, session_jti: string) {
  return db("refresh_tokens")
    .where({ user_id })
    .whereNot({ session_jti })
    .update({ revoked_at: new Date().toISOString() });
}

export async function findRefreshTokenRaw(
  token_hash: string,
): Promise<RefreshTokenRecord | undefined> {
  return db<RefreshTokenRecord>("refresh_tokens").where({ token_hash }).first();
}
