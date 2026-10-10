import type { Knex } from "knex";
import sharp from "sharp";
import { HttpError } from "../../utils/http.js";
import { scanBuffer } from "../../services/antivirus.service.js";
import { deleteStorageObject, saveUserAvatarFile } from "../../services/mediaStorage.service.js";
import { insertAudit } from "../common/audit.util.js";
import { saveUserAvatarMetadata } from "../users/users.avatar.repository.js";

const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export interface RegistrationAvatarFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface PersistedRegistrationAvatar {
  storageKey: string;
  bytes: number;
  recordId: string;
}

export async function prepareRegistrationAvatar(file: RegistrationAvatarFile): Promise<Buffer> {
  if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
    throw new HttpError(422, "UPLOAD_UNSUPPORTED_TYPE", "UPLOAD_UNSUPPORTED_TYPE");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new HttpError(422, "UPLOAD_TOO_LARGE", "UPLOAD_TOO_LARGE");
  }

  const scanResult = await scanBuffer(file.buffer, file.originalname);
  if (scanResult.isInfected) {
    throw new HttpError(422, "E.UPLOAD.MALWARE_DETECTED", "UPLOAD_MALWARE_DETECTED", {
      reason: "malware_detected",
      viruses: scanResult.viruses,
    });
  }

  let imageFormat: string | undefined;
  try {
    imageFormat = (await sharp(file.buffer).metadata()).format;
  } catch {
    throw new HttpError(422, "UPLOAD_UNSUPPORTED_TYPE", "UPLOAD_UNSUPPORTED_TYPE");
  }

  if (!imageFormat || !["jpeg", "png", "webp"].includes(imageFormat)) {
    throw new HttpError(422, "UPLOAD_UNSUPPORTED_TYPE", "UPLOAD_UNSUPPORTED_TYPE");
  }

  return sharp(file.buffer)
    .rotate()
    .resize(128, 128, { fit: "cover" })
    .png({ quality: 80 })
    .toBuffer();
}

export async function persistRegistrationAvatar(
  userId: string,
  processed: Buffer,
  trx: Knex.Transaction,
): Promise<PersistedRegistrationAvatar> {
  const fileMeta = await saveUserAvatarFile(userId, processed, "image/png");
  try {
    const { record } = await saveUserAvatarMetadata(
      userId,
      {
        storageKey: fileMeta.storageKey,
        fileUrl: `/api/v1/users/avatar/${userId}`,
        mimeType: "image/png",
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
      mime: "image/png",
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
