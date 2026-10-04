import crypto from "crypto";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type { ContactUpsertDTO } from "./users.types.js";
import { findUserById, type UserRow } from "./users.core.repository.js";

const CONTACTS_TABLE = "user_contacts";
const MEDIA_TABLE = "media";
const AVATAR_TARGET_TYPE = "user_avatar";

export type ContactRow = {
  id: string;
  user_id: string;
  type: "email" | "phone";
  value: string;
  is_primary: boolean;
  is_recovery: boolean;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
};

export type AvatarRow = {
  id: string;
  owner_id: string;
  target_type: string;
  target_id: string;
  storage_key: string;
  file_url: string;
  mime_type: string | null;
  media_type: string | null;
  bytes: number | null;
  created_at: string;
  updated_at: string | null;
};

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

export async function getUserContacts(
  userId: string,
  trx?: Knex.Transaction,
): Promise<ContactRow[]> {
  return withDb(trx)<ContactRow>(CONTACTS_TABLE)
    .where({ user_id: userId })
    .orderBy("created_at", "asc");
}

export async function getUserAvatar(
  userId: string,
  trx?: Knex.Transaction,
): Promise<AvatarRow | null> {
  const row = await withDb(trx)<AvatarRow>(MEDIA_TABLE)
    .where({
      owner_id: userId,
      target_type: AVATAR_TARGET_TYPE,
      target_id: userId,
    })
    .orderBy("created_at", "desc")
    .first();
  return row ?? null;
}

export async function getContactById(
  contactId: string,
  trx?: Knex.Transaction,
): Promise<ContactRow | undefined> {
  return withDb(trx)<ContactRow>(CONTACTS_TABLE).where({ id: contactId }).first();
}

export async function fetchUserWithContacts(
  userId: string,
  trx?: Knex.Transaction,
): Promise<{ user: UserRow; contacts: ContactRow[]; avatar: AvatarRow | null } | null> {
  const user = await findUserById(userId, trx);
  if (!user) {
    return null;
  }
  const contacts = await getUserContacts(userId, trx);
  const avatar = await getUserAvatar(userId, trx);
  return { user, contacts, avatar };
}

export async function upsertContact(
  userId: string,
  dto: ContactUpsertDTO,
  trx?: Knex.Transaction,
): Promise<number> {
  const dbOrTrx = withDb(trx);
  const now = new Date().toISOString();
  const trimmedValue = dto.value.trim();
  const normalizedValue = dto.type === "email" ? trimmedValue.toLowerCase() : trimmedValue;
  const isPrimary = dto.isPrimary ?? dto.type === "email";
  const isRecovery = dto.isRecovery ?? dto.type === "phone";

  if (isPrimary) {
    await dbOrTrx(CONTACTS_TABLE).where({ user_id: userId }).update({ is_primary: false });
  }

  const existing = await dbOrTrx<ContactRow>(CONTACTS_TABLE)
    .where({ user_id: userId, type: dto.type })
    .orderBy("created_at", "asc")
    .first();

  if (existing) {
    const normalizedExistingValue =
      dto.type === "email" ? existing.value.toLowerCase() : existing.value.trim();
    const valueChanged = normalizedExistingValue !== normalizedValue;
    return dbOrTrx(CONTACTS_TABLE)
      .where({ id: existing.id })
      .update({
        value: normalizedValue,
        is_primary: isPrimary,
        is_recovery: isRecovery,
        is_verified: valueChanged ? false : existing.is_verified,
        verified_at: valueChanged ? null : existing.verified_at,
      });
  }

  return dbOrTrx(CONTACTS_TABLE).insert({
    id: crypto.randomUUID(),
    user_id: userId,
    type: dto.type,
    value: normalizedValue,
    is_primary: isPrimary,
    is_recovery: isRecovery,
    is_verified: false,
    verified_at: null,
    created_at: now,
  });
}

export async function markContactVerified(
  contactId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  return withDb(trx)(CONTACTS_TABLE)
    .where({ id: contactId })
    .update({ is_verified: true, verified_at: new Date().toISOString() });
}

export async function deleteContact(
  userId: string,
  contactId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  return withDb(trx)(CONTACTS_TABLE).where({ id: contactId, user_id: userId }).del();
}
