import crypto from "crypto";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type { UpdateProfileDTO, UserStatus } from "./users.types.js";
import type { MeasurementSystem, SessionVisibility, UserLanguage } from "@fitvibe/contracts";

const USERS_TABLE = "users";
const CONTACTS_TABLE = "user_contacts";
const STATE_TABLE = "user_state_history";
const MEDIA_TABLE = "media";
const AVATAR_TARGET_TYPE = "user_avatar";
const PROFILES_TABLE = "profiles";

export interface CreateUserRecordInput {
  id: string;
  displayName: string;
  locale?: string;
  preferredLang?: UserLanguage;
  status: UserStatus;
  roleCode: string;
  passwordHash: string;
}

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  locale: string;
  preferred_lang: UserLanguage;
  default_visibility: SessionVisibility;
  units: MeasurementSystem;
  status: UserStatus;
  role_code: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  primary_email?: string | null;
  avatar_url?: string | null;
  avatar_updated_at?: string | null;
  avatar_mime_type?: string | null;
  avatar_bytes?: number | string | null;
};

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const normalized = email.toLowerCase();
  return db(USERS_TABLE)
    .leftJoin(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${USERS_TABLE}.id`)
    .select<UserRow[]>(`${USERS_TABLE}.*`, db.raw(`${PROFILES_TABLE}.alias as username`))
    .joinRaw(
      `INNER JOIN ${CONTACTS_TABLE} c ON c.user_id = ${USERS_TABLE}.id AND c.type = ? AND c.is_primary IS TRUE`,
      ["email"],
    )
    .whereRaw("LOWER(c.value) = ?", [normalized])
    .first();
}

export async function findUserById(
  id: string,
  trx?: Knex.Transaction,
): Promise<UserRow | undefined> {
  return withDb(trx)<UserRow>(USERS_TABLE)
    .leftJoin(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${USERS_TABLE}.id`)
    .select<UserRow[]>(`${USERS_TABLE}.*`, db.raw(`${PROFILES_TABLE}.alias as username`))
    .where(`${USERS_TABLE}.id`, id)
    .first();
}

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  return db<UserRow>(USERS_TABLE)
    .join(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${USERS_TABLE}.id`)
    .select<UserRow[]>(`${USERS_TABLE}.*`, db.raw(`${PROFILES_TABLE}.alias as username`))
    .whereRaw(`LOWER(${PROFILES_TABLE}.alias) = ?`, [username.toLowerCase()])
    .first();
}

export async function listUsers(limit = 50, offset = 0): Promise<UserRow[]> {
  return db(USERS_TABLE)
    .leftJoin(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${USERS_TABLE}.id`)
    .select(
      `${USERS_TABLE}.id`,
      db.raw(`${PROFILES_TABLE}.alias as username`),
      `${USERS_TABLE}.display_name`,
      `${USERS_TABLE}.locale`,
      `${USERS_TABLE}.preferred_lang`,
      `${USERS_TABLE}.default_visibility`,
      `${USERS_TABLE}.units`,
      `${USERS_TABLE}.status`,
      `${USERS_TABLE}.role_code`,
      `${USERS_TABLE}.created_at`,
      `${USERS_TABLE}.updated_at`,
      db.raw(
        `(SELECT value FROM ${CONTACTS_TABLE} ec WHERE ec.user_id = ${USERS_TABLE}.id AND ec.type = 'email' AND ec.is_primary IS TRUE LIMIT 1) AS primary_email`,
      ),
      db.raw(
        `(SELECT file_url FROM ${MEDIA_TABLE} m WHERE m.owner_id = ${USERS_TABLE}.id AND m.target_type = ? AND m.target_id = ${USERS_TABLE}.id ORDER BY m.created_at DESC LIMIT 1) AS avatar_url`,
        [AVATAR_TARGET_TYPE],
      ),
      db.raw(
        `(SELECT created_at FROM ${MEDIA_TABLE} m WHERE m.owner_id = ${USERS_TABLE}.id AND m.target_type = ? AND m.target_id = ${USERS_TABLE}.id ORDER BY m.created_at DESC LIMIT 1) AS avatar_updated_at`,
        [AVATAR_TARGET_TYPE],
      ),
      db.raw(
        `(SELECT mime_type FROM ${MEDIA_TABLE} m WHERE m.owner_id = ${USERS_TABLE}.id AND m.target_type = ? AND m.target_id = ${USERS_TABLE}.id ORDER BY m.created_at DESC LIMIT 1) AS avatar_mime_type`,
        [AVATAR_TARGET_TYPE],
      ),
      db.raw(
        `(SELECT bytes FROM ${MEDIA_TABLE} m WHERE m.owner_id = ${USERS_TABLE}.id AND m.target_type = ? AND m.target_id = ${USERS_TABLE}.id ORDER BY m.created_at DESC LIMIT 1) AS avatar_bytes`,
        [AVATAR_TARGET_TYPE],
      ),
    )
    .orderBy(`${USERS_TABLE}.created_at`, "desc")
    .limit(limit)
    .offset(offset);
}

export async function changePassword(id: string, password_hash: string): Promise<number> {
  return db(USERS_TABLE)
    .where({ id })
    .update({ password_hash, updated_at: new Date().toISOString() });
}

export async function updateUserProfile(
  userId: string,
  updates: UpdateProfileDTO,
  trx?: Knex.Transaction,
) {
  const patch: Record<string, unknown> = {};
  if (updates.displayName !== undefined) {
    patch.display_name = updates.displayName;
  }

  if (!Object.keys(patch).length) {
    return 0;
  }

  patch.updated_at = new Date().toISOString();
  return withDb(trx)(USERS_TABLE).where({ id: userId }).update(patch);
}

export async function createUserRecord(
  input: CreateUserRecordInput,
  trx?: Knex.Transaction,
): Promise<number> {
  const now = new Date().toISOString();
  return withDb(trx)(USERS_TABLE).insert({
    id: input.id,
    display_name: input.displayName,
    locale: input.locale ?? "en-US",
    preferred_lang: input.preferredLang ?? "en",
    status: input.status,
    role_code: input.roleCode,
    password_hash: input.passwordHash,
    created_at: now,
    updated_at: now,
  });
}

export async function setUserStatus(
  userId: string,
  status: UserStatus,
  trx?: Knex.Transaction,
): Promise<number> {
  return withDb(trx)(USERS_TABLE)
    .where({ id: userId })
    .update({ status, updated_at: new Date().toISOString() });
}

export async function insertStateHistory(
  userId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  trx?: Knex.Transaction,
  actorUserId?: string | null,
  requestId?: string | null,
): Promise<number> {
  const dbConn = withDb(trx);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const result: { rowCount?: number } = await dbConn.raw(
    `
    INSERT INTO ${STATE_TABLE} (id, user_id, field, old_value, new_value, changed_at, actor_user_id, request_id)
    VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)
    `,
    [
      id,
      userId,
      field,
      oldValue === null || oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue === null || newValue === undefined ? null : JSON.stringify(newValue),
      now,
      actorUserId ?? userId,
      requestId ?? null,
    ],
  );
  return result.rowCount ?? 1;
}
