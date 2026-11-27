import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { logger } from "../../config/logger.js";
import {
  saveUserAvatarMetadata,
  getUserAvatarMetadata,
  deleteUserAvatarMetadata,
} from "./users.avatar.repository.js";
import {
  deleteStorageObject,
  readStorageObject,
  saveUserAvatarFile,
} from "../../services/mediaStorage.service.js";
import {
  AVATAR_RENDITION,
  IMAGE_UPLOAD_ERRORS,
  imageFileProblem,
  prepareImage,
} from "../../services/imageUpload.service.js";
import { HttpError } from "../../utils/http.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";

export async function uploadAvatarHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub as string;
  const problem = imageFileProblem(req.file);
  if (problem || !req.file) {
    res.status(422).json({ error: problem ?? IMAGE_UPLOAD_ERRORS.noFile });
    return;
  }

  const file = req.file;
  const execute = async (): Promise<{ status: 201 | 422; body: Record<string, unknown> }> => {
    let processed: Buffer;
    try {
      processed = (await prepareImage(file, AVATAR_RENDITION)).buffer;
    } catch (error) {
      if (!(error instanceof HttpError)) {
        throw error;
      }
      if (error.code !== IMAGE_UPLOAD_ERRORS.malware) {
        return { status: 422, body: { error: error.code } };
      }
      const { viruses } = error.details as { viruses: string[] };
      logger.warn(
        { userId, filename: file.originalname, viruses, size: file.size },
        "[avatar] Malware detected in upload",
      );
      await insertAudit({
        actorUserId: userId,
        entityType: "user_media",
        action: "avatar_upload_rejected",
        entityId: userId,
        metadata: {
          reason: "malware_detected",
          viruses,
          filename: file.originalname,
          size: file.size,
        },
      });
      return {
        status: 422,
        body: {
          error: {
            code: IMAGE_UPLOAD_ERRORS.malware,
            message: "UPLOAD_MALWARE_DETECTED",
            details: { reason: "malware_detected" },
          },
        },
      };
    }

    const fileMeta = await saveUserAvatarFile(userId, processed, AVATAR_RENDITION.mimeType);
    const publicUrl = `/api/v1/users/avatar/${userId}`;
    let saved: Awaited<ReturnType<typeof saveUserAvatarMetadata>>;
    try {
      saved = await saveUserAvatarMetadata(userId, {
        storageKey: fileMeta.storageKey,
        fileUrl: publicUrl,
        mimeType: AVATAR_RENDITION.mimeType,
        bytes: fileMeta.bytes,
      });
    } catch (error) {
      // The file is written before its database metadata. Avoid leaving an
      // orphan on disk if the database rejects the new avatar.
      await deleteStorageObject(fileMeta.storageKey).catch((cleanupError: unknown) => {
        logger.error(
          { err: cleanupError, storageKey: fileMeta.storageKey },
          "[avatar] cleanup failed",
        );
      });
      throw error;
    }

    const { previousKey, record } = saved;
    if (previousKey) {
      await deleteStorageObject(previousKey).catch(() => undefined);
    }

    await insertAudit({
      actorUserId: userId,
      entityType: "user_media",
      action: "avatar_upload",
      entityId: record.id,
      metadata: { size: fileMeta.bytes, mime: AVATAR_RENDITION.mimeType },
    });

    return {
      status: 201,
      body: {
        success: true,
        fileUrl: publicUrl,
        bytes: fileMeta.bytes,
        mimeType: AVATAR_RENDITION.mimeType,
        updatedAt: record.created_at,
        preview: `data:${AVATAR_RENDITION.mimeType};base64,${processed.toString("base64")}`,
      },
    };
  };

  const payload = {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
  };
  const handled = await handleIdempotentRequest(req, res, userId, payload, execute);

  if (!handled) {
    const result = await execute();
    res.status(result.status).json(result.body);
  }
}

export async function getAvatarHandler(req: Request, res: Response): Promise<void> {
  const id = readRouteParam(req.params.id, "id");
  const metadata = await getUserAvatarMetadata(id);
  if (!metadata) {
    res.status(404).send("UPLOAD_NOT_FOUND");
    return;
  }
  try {
    const buffer = await readStorageObject(metadata.storage_key);
    res.set("Content-Type", metadata.mime_type ?? AVATAR_RENDITION.mimeType);
    res.set("Cache-Control", "private, max-age=300");
    res.send(buffer);
    return;
  } catch (error) {
    logger.error({ err: error }, "[avatar] read failed");
    res.status(404).send("UPLOAD_NOT_FOUND");
    return;
  }
}

export async function deleteAvatarHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub as string;

  const execute = async () => {
    const metadata = await deleteUserAvatarMetadata(userId);
    if (metadata?.storage_key) {
      await deleteStorageObject(metadata.storage_key).catch(() => undefined);
    }
    await insertAudit({
      actorUserId: userId,
      entityType: "user_media",
      action: "avatar_delete",
      entityId: metadata?.id ?? userId,
    });
  };

  const handled = await handleIdempotentRequest(req, res, userId, {}, async () => {
    await execute();
    return { status: 204, body: null };
  });

  if (!handled) {
    await execute();
    res.status(204).send();
  }
}
