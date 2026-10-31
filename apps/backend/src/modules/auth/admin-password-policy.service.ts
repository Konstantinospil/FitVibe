import { db } from "../../db/connection.js";

/**
 * Only credential writes validated against the *active admin role* may set
 * this timestamp. Do not infer it from Argon2id/bcrypt hashes, authentication
 * success or opportunistic hash upgrades.
 */
export async function administratorPasswordChangeRequired(userId: string): Promise<boolean> {
  const row = await db("users")
    .where({ id: userId })
    .first<{ admin_password_policy_verified_at: string | null }>(
      "admin_password_policy_verified_at",
    );
  return !row?.admin_password_policy_verified_at;
}
