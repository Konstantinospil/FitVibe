import type { Knex } from "knex";
import { db } from "../../db/connection.js";

const TABLE = "registration_intents";

export interface RegistrationIntentRecord {
  id: string;
  email_hash: string;
  email: string | null;
  token_hash: string | null;
  locale: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface RegistrationIntentInsert {
  id: string;
  email_hash: string;
  email?: string | null;
  token_hash?: string | null;
  locale?: string | null;
  created_at: string;
  expires_at: string;
}

export async function insertRegistrationIntent(row: RegistrationIntentInsert): Promise<void> {
  await db(TABLE).insert({
    email: null,
    token_hash: null,
    locale: null,
    ...row,
  });
}

/** Requests recorded for one address since `since`, whatever their outcome. */
export async function countRegistrationIntentsSince(emailHash: string, since: Date) {
  const result = await db(TABLE)
    .where({ email_hash: emailHash })
    .where("created_at", ">=", since.toISOString())
    .count<{ count: string }>("id as count")
    .first();
  return Number(result?.count ?? 0);
}

/** Retire every outstanding link for an address so only the newest one works. */
export async function consumeOpenRegistrationLinks(emailHash: string, now: Date) {
  return db(TABLE)
    .where({ email_hash: emailHash })
    .whereNotNull("token_hash")
    .whereNull("consumed_at")
    .update({ consumed_at: now.toISOString() });
}

/** Find an unconsumed link by token hash. Expiry is checked by the caller. */
export async function findOpenRegistrationIntent(
  tokenHash: string,
  trx?: Knex.Transaction,
  options: { forUpdate?: boolean } = {},
): Promise<RegistrationIntentRecord | undefined> {
  const query = (trx ?? db)<RegistrationIntentRecord>(TABLE)
    .where({ token_hash: tokenHash })
    .whereNull("consumed_at");
  if (options.forUpdate) {
    void query.forUpdate();
  }
  return query.first();
}

export async function consumeRegistrationIntent(id: string, trx?: Knex.Transaction) {
  return (trx ?? db)(TABLE)
    .where({ id })
    .whereNull("consumed_at")
    .update({ consumed_at: new Date().toISOString() });
}

export async function purgeExpiredRegistrationIntents(now: Date): Promise<number> {
  return db(TABLE).where("expires_at", "<", now.toISOString()).del();
}
