import { db } from "../../db/connection.js";

interface AuthTokenInsert {
  id: string;
  user_id: string;
  token_type: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  consumed_at?: string | null;
}

export interface AuthTokenRecord extends AuthTokenInsert {
  consumed_at: string | null;
}

export async function createAuthToken(row: AuthTokenInsert): Promise<AuthTokenRecord[]> {
  return db<AuthTokenRecord>("auth_tokens").insert(row).returning("*");
}

export async function deleteAuthTokensByType(userId: string, tokenType: string) {
  return db("auth_tokens").where({ user_id: userId, token_type: tokenType }).del();
}

export async function findAuthToken(
  tokenType: string,
  tokenHash: string,
): Promise<AuthTokenRecord | undefined> {
  return db<AuthTokenRecord>("auth_tokens")
    .where({ token_type: tokenType, token_hash: tokenHash })
    .whereNull("consumed_at")
    .first();
}

export async function consumeAuthToken(id: string) {
  return db("auth_tokens").where({ id }).update({ consumed_at: new Date().toISOString() });
}

export async function markAuthTokensConsumed(userId: string, tokenType: string) {
  return db("auth_tokens")
    .where({ user_id: userId, token_type: tokenType })
    .whereNull("consumed_at")
    .update({ consumed_at: new Date().toISOString() });
}

export async function countAuthTokensSince(userId: string, tokenType: string, since: Date) {
  const result = await db("auth_tokens")
    .where({ user_id: userId, token_type: tokenType })
    .where("created_at", ">=", since.toISOString())
    .count<{ count: string }>("id as count")
    .first();
  return Number(result?.count ?? 0);
}

export async function purgeAuthTokensOlderThan(tokenType: string, olderThan: Date) {
  return db("auth_tokens")
    .where({ token_type: tokenType })
    .andWhere("created_at", "<", olderThan.toISOString())
    .del();
}
