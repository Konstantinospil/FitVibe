import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import sharp from "sharp";
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
import { scanBuffer } from "../../services/antivirus.service.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per PRD

export async function uploadAvatarHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub as string;
  if (!req.file) {
    res.status(400).json({ error: "UPLOAD_NO_FILE" });
    return;
  }
  if (!ALLOWED_MIME.has(req.file.mimetype)) {
    res.status(400).json({ error: "UPLOAD_UNSUPPORTED_TYPE" });
    return;
  }
  if (req.file.size > MAX_BYTES) {
    res.status(400).json({ error: "UPLOAD_TOO_LARGE" });
    return;
  }

  const file = req.file;
  const execute = async (): Promise<{ status: 201 | 422; body: Record<string, unknown> }> => {
    const scanResult = await scanBuffer(file.buffer, file.originalname);
    if (scanResult.isInfected) {
      logger.warn(
        {
          userId,
          filename: file.originalname,
          viruses: scanResult.viruses,
          size: file.size,
        },
        "[avatar] Malware detected in upload",
      );

      await insertAudit({
        actorUserId: userId,
        entityType: "user_media",
        action: "avatar_upload_rejected",
        entityId: userId,
        metadata: {
          reason: "malware_detected",
          viruses: scanResult.viruses,
          filename: file.originalname,
          size: file.size,
        },
      });

      return {
        status: 422,
        body: {
          error: {
            code: "E.UPLOAD.MALWARE_DETECTED",
            message: "UPLOAD_MALWARE_DETECTED",
            details: { reason: "malware_detected" },
          },
        },
      };
    }

    const processed = await sharp(file.buffer)
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .png({ quality: 80 })
      .toBuffer();

    const fileMeta = await saveUserAvatarFile(userId, processed, "image/png");
    const publicUrl = `/api/v1/users/avatar/${userId}`;
    const { previousKey, record } = await saveUserAvatarMetadata(userId, {
      storageKey: fileMeta.storageKey,
      fileUrl: publicUrl,
      mimeType: "image/png",
      bytes: fileMeta.bytes,
    });

    if (previousKey) {
      await deleteStorageObject(previousKey).catch(() => undefined);
    }

    await insertAudit({
      actorUserId: userId,
      entityType: "user_media",
      action: "avatar_upload",
      entityId: record.id,
      metadata: { size: fileMeta.bytes, mime: "image/png" },
    });

    return {
      status: 201,
      body: {
        success: true,
        fileUrl: publicUrl,
        bytes: fileMeta.bytes,
        mimeType: "image/png",
        updatedAt: record.created_at,
        preview: `data:image/png;base64,${processed.toString("base64")}`,
      },
    };
  };

  const payload = {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
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
    res.set("Content-Type", metadata.mime_type ?? "image/png");
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
