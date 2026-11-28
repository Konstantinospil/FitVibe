import type { Knex } from "knex";
import {
  AVATAR_RENDITION,
  prepareImage,
  type UploadedImageFile,
} from "../../services/imageUpload.service.js";
import { deleteStorageObject, saveUserAvatarFile } from "../../services/mediaStorage.service.js";
import { insertAudit } from "../common/audit.util.js";
import { saveUserAvatarMetadata } from "../users/users.avatar.repository.js";

export type RegistrationAvatarFile = UploadedImageFile;

export interface PersistedRegistrationAvatar {
  storageKey: string;
  bytes: number;
  recordId: string;
}

/** Checks, scans and re-encodes the avatar chosen at registration (shared pipeline). */
export async function prepareRegistrationAvatar(file: RegistrationAvatarFile): Promise<Buffer> {
  return (await prepareImage(file, AVATAR_RENDITION)).buffer;
}

export async function persistRegistrationAvatar(
  userId: string,
  processed: Buffer,
  trx: Knex.Transaction,
): Promise<PersistedRegistrationAvatar> {
  const fileMeta = await saveUserAvatarFile(userId, processed, AVATAR_RENDITION.mimeType);
  try {
    const { record } = await saveUserAvatarMetadata(
      userId,
      {
        storageKey: fileMeta.storageKey,
        fileUrl: `/api/v1/users/avatar/${userId}`,
        mimeType: AVATAR_RENDITION.mimeType,
        bytes: fileMeta.bytes,
      },
      trx,
    );
    return {
      storageKey: fileMeta.storageKey,
      bytes: fileMeta.bytes,
      recordId: record.id,
    };
  } catch (error) {
    await deleteStorageObject(fileMeta.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function auditRegistrationAvatar(
  userId: string,
  avatar: PersistedRegistrationAvatar,
): Promise<void> {
  await insertAudit({
    actorUserId: userId,
    entityType: "user_media",
    action: "avatar_upload",
    entityId: avatar.recordId,
    metadata: {
      size: avatar.bytes,
      mime: AVATAR_RENDITION.mimeType,
      source: "registration",
    },
  });
}

export async function cleanupRegistrationAvatar(
  avatar: PersistedRegistrationAvatar | null,
): Promise<void> {
  if (avatar) {
    await deleteStorageObject(avatar.storageKey).catch(() => undefined);
  }
}
