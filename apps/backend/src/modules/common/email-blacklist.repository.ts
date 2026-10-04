import { db } from "../../db/index.js";

/**
 * Authoritative email-blacklist lookup.
 *
 * Deliberately does not catch database/schema failures. Security-sensitive
 * callers must fail closed when blacklist state cannot be read.
 */
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const row = await db<{ id: string }>("blacklist")
    .where("email", normalizedEmail)
    .where(function () {
      this.whereNull("active_to").orWhere("active_to", ">", now);
    })
    .where("active_from", "<=", now)
    .first();

  return Boolean(row);
}
