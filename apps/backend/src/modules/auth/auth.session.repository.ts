import { db } from "../../db/connection.js";
import { withUserForeignKeyVisibilityRetry } from "./auth.fk-retry.js";

interface AuthSessionInsert {
  jti: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  revoked_at?: string | null;
  last_active_at?: string | null;
}

export interface AuthSessionRecord extends AuthSessionInsert {
  revoked_at: string | null;
  last_active_at: string | null;
}

export async function createAuthSession(row: AuthSessionInsert): Promise<AuthSessionRecord[]> {
  return withUserForeignKeyVisibilityRetry("auth_sessions", () =>
    db<AuthSessionRecord>("auth_sessions").insert(row).returning("*"),
  );
}

export async function findSessionById(jti: string): Promise<AuthSessionRecord | undefined> {
  return db<AuthSessionRecord>("auth_sessions").where({ jti }).first();
}

export async function listSessionsByUserId(user_id: string): Promise<AuthSessionRecord[]> {
  return db<AuthSessionRecord>("auth_sessions").where({ user_id }).orderBy("created_at", "desc");
}

export async function updateSession(
  jti: string,
  patch: {
    expires_at?: string;
    user_agent?: string | null;
    ip?: string | null;
  },
) {
  return db("auth_sessions").where({ jti }).update(patch);
}

export async function revokeSessionById(jti: string) {
  return db("auth_sessions").where({ jti }).update({ revoked_at: new Date().toISOString() });
}

export async function revokeSessionsByUserId(user_id: string, excludeJti?: string) {
  const query = db("auth_sessions").where({ user_id }).whereNull("revoked_at");
  if (excludeJti) {
    query.andWhereNot({ jti: excludeJti });
  }
  return query.update({ revoked_at: new Date().toISOString() });
}

export async function purgeExpiredSessions(olderThan: Date) {
  return db("auth_sessions").where("expires_at", "<", olderThan.toISOString()).del();
}
