import type { Knex } from "knex";
import { db } from "../../db/connection.js";

const MEDIA_TABLE = "media";
const TARGET_TYPE = "user_avatar";

interface AvatarMeta {
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
  // Note: media table doesn't have updated_at column, only created_at
}

export async function saveUserAvatarMetadata(
  userId: string,
  meta: {
    storageKey: string;
    fileUrl: string;
    mimeType: string;
    bytes: number;
  },
  trx?: Knex.Transaction,
): Promise<{ previousKey: string | null; record: AvatarMeta }> {
  const connection = trx ?? db;
  const existing = await connection<AvatarMeta>(MEDIA_TABLE)
    .where({ owner_id: userId, target_type: TARGET_TYPE, target_id: userId })
    .first();
  const now = new Date().toISOString();

  if (existing) {
    await connection(MEDIA_TABLE).where({ id: existing.id }).update({
      storage_key: meta.storageKey,
      file_url: meta.fileUrl,
      mime_type: meta.mimeType,
      bytes: meta.bytes,
      // Note: media table doesn't have updated_at column, only created_at
    });

    const updated = await connection<AvatarMeta>(MEDIA_TABLE).where({ id: existing.id }).first();
    return {
      previousKey: existing.storage_key,
      record: updated ?? existing,
    };
  }

  const [created] = await connection<AvatarMeta>(MEDIA_TABLE)
    .insert({
      owner_id: userId,
      target_type: TARGET_TYPE,
      target_id: userId,
      storage_key: meta.storageKey,
      file_url: meta.fileUrl,
      mime_type: meta.mimeType,
      media_type: "image",
      bytes: meta.bytes,
      created_at: now,
      // Note: media table doesn't have updated_at column, only created_at
    })
    .returning("*");

  return {
    previousKey: null,
    record: created,
  };
}

export async function getUserAvatarMetadata(userId: string): Promise<AvatarMeta | null> {
  const row = await db<AvatarMeta>(MEDIA_TABLE)
    .where({ owner_id: userId, target_type: TARGET_TYPE, target_id: userId })
    .first();
  return row ?? null;
}

export async function deleteUserAvatarMetadata(userId: string): Promise<AvatarMeta | null> {
  const existing = await db<AvatarMeta>(MEDIA_TABLE)
    .where({ owner_id: userId, target_type: TARGET_TYPE, target_id: userId })
    .first();
  if (!existing) {
    return null;
  }
  await db(MEDIA_TABLE).where({ id: existing.id }).del();
  return existing;
}
