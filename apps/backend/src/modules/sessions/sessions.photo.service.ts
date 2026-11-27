import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  PHOTO_RENDITION,
  prepareImage,
  type UploadedImageFile,
} from "../../services/imageUpload.service.js";
import {
  MEDIA_FOLDERS,
  deleteStorageObject,
  readStorageObject,
  saveMediaFile,
} from "../../services/mediaStorage.service.js";
import {
  SESSION_PHOTO_TARGET,
  findSessionPhoto,
  getSessionById,
  sessionPhotoRows,
  sessionPhotoUrl,
} from "./sessions.repository.js";
import type { SessionPhoto } from "./sessions.types.js";

/**
 * The workout photo (ADR-044, issue 365). One per session, only for its owner. It
 * can be added once the workout is completed (either outcome); replacing or
 * removing it is allowed later, also while a reopened session is corrected.
 * The file goes through the shared image pipeline: checked, scanned, re-encoded.
 */

const AUDIT_ENTITY = "session_media";

/** A replaced photo gets a new id and URL, so a photo's bytes never change. */
export const SESSION_PHOTO_CACHE_CONTROL = "private, max-age=86400, immutable";

const notFound = () => new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
const notCompleted = () =>
  new HttpError(
    409,
    "E.SESSION.PHOTO_NOT_COMPLETED",
    "A photo can be added once the workout is completed",
  );

async function ownSession(userId: string, sessionId: string) {
  const session = await getSessionById(sessionId, userId);
  if (!session) {
    throw notFound();
  }
  return session;
}

const removeFiles = async (storageKeys: string[]) => {
  await Promise.all(
    storageKeys.map((storageKey) =>
      deleteStorageObject(storageKey).catch((error: unknown) => {
        logger.warn({ err: error, storageKey }, "[session-photo] file cleanup failed");
      }),
    ),
  );
};

/** Adds or replaces the photo of a completed workout. */
export async function saveSessionPhoto(
  userId: string,
  sessionId: string,
  file: UploadedImageFile | undefined,
): Promise<SessionPhoto> {
  const session = await ownSession(userId, sessionId);
  if (session.status !== "completed") {
    throw notCompleted();
  }

  const image = await prepareImage(file, PHOTO_RENDITION);
  const stored = await saveMediaFile(MEDIA_FOLDERS.sessions, userId, image.buffer, image.mimeType);
  const id = uuidv4();

  let replacedKeys: string[];
  try {
    replacedKeys = await db.transaction(async (trx) => {
      // Lock the session so two uploads cannot both find no photo, and re-check it.
      const locked = (await trx("sessions")
        .where({ id: sessionId, owner_id: userId })
        .whereNull("deleted_at")
        .forUpdate()
        .first("status")) as { status: string } | undefined;
      if (!locked) {
        throw notFound();
      }
      if (locked.status !== "completed") {
        throw notCompleted();
      }
      const previous = await sessionPhotoRows(sessionId, trx);
      if (previous.length > 0) {
        await trx("media")
          .whereIn(
            "id",
            previous.map((row) => row.id),
          )
          .del();
      }
      await trx("media").insert({
        id,
        owner_id: userId,
        target_type: SESSION_PHOTO_TARGET,
        target_id: sessionId,
        storage_key: stored.storageKey,
        file_url: sessionPhotoUrl(sessionId, id),
        mime_type: image.mimeType,
        media_type: "image",
        bytes: stored.bytes,
      });
      return previous.map((row) => row.storage_key);
    });
  } catch (error) {
    // The file was written first; never leave it behind without its record.
    await removeFiles([stored.storageKey]);
    throw error;
  }

  await removeFiles(replacedKeys);
  await insertAudit({
    actorUserId: userId,
    entityType: AUDIT_ENTITY,
    action: replacedKeys.length > 0 ? "session_photo_replaced" : "session_photo_uploaded",
    entityId: id,
    metadata: { session_id: sessionId, bytes: stored.bytes, mime: image.mimeType },
  });

  const photo = await findSessionPhoto(sessionId);
  if (!photo) {
    throw notFound();
  }
  return photo;
}

/** Removes the photo; removing one that is already gone succeeds too. */
export async function deleteSessionPhoto(userId: string, sessionId: string): Promise<void> {
  await ownSession(userId, sessionId);
  const removed = await db.transaction(async (trx) => {
    const rows = await sessionPhotoRows(sessionId, trx);
    if (rows.length > 0) {
      await trx("media")
        .whereIn(
          "id",
          rows.map((row) => row.id),
        )
        .del();
    }
    return rows;
  });
  if (removed.length === 0) {
    return;
  }
  await removeFiles(removed.map((row) => row.storage_key));
  await insertAudit({
    actorUserId: userId,
    entityType: AUDIT_ENTITY,
    action: "session_photo_deleted",
    entityId: removed[0].id,
    metadata: { session_id: sessionId },
  });
}

/** The image bytes, for the owner only; anyone else gets the same 404 as for nothing. */
export async function readSessionPhoto(
  userId: string,
  sessionId: string,
  photoId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  await ownSession(userId, sessionId);
  const row = (await sessionPhotoRows(sessionId)).find((candidate) => candidate.id === photoId);
  if (!row) {
    throw new HttpError(404, "E.SESSION.PHOTO_NOT_FOUND", "PHOTO_NOT_FOUND");
  }
  try {
    return { buffer: await readStorageObject(row.storage_key), mimeType: row.mime_type };
  } catch (error) {
    logger.error({ err: error, sessionId }, "[session-photo] read failed");
    throw new HttpError(404, "E.SESSION.PHOTO_NOT_FOUND", "PHOTO_NOT_FOUND");
  }
}
