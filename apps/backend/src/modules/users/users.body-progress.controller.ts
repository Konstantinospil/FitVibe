import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import { z } from "zod";
import { PHOTO_RENDITION, prepareImage } from "../../services/imageUpload.service.js";
import {
  deleteStorageObject,
  readStorageObject,
  saveUserProgressPhotoFile,
} from "../../services/mediaStorage.service.js";
import { insertAudit } from "../common/audit.util.js";
import {
  addBodyProgressPhoto,
  addBodyWeight,
  deleteBodyProgressPhoto,
  getBodyProgressPhoto,
  listBodyProgressPhotos,
  listBodyWeights,
} from "./users.body-progress.repository.js";

const weightSchema = z.object({
  weightKg: z.number().min(20).max(500),
  measuredAt: z.string().datetime().optional(),
});

export async function getBodyProgressHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [weights, photos] = await Promise.all([
    listBodyWeights(userId),
    listBodyProgressPhotos(userId),
  ]);
  res.json({ weights, photos });
}

export async function addBodyWeightHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = weightSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const entry = await addBodyWeight(
    userId,
    parsed.data.weightKg,
    parsed.data.measuredAt ?? new Date().toISOString(),
  );

  await insertAudit({
    actorUserId: userId,
    entityType: "body_progress",
    action: "weight_recorded",
    entityId: entry.id,
    metadata: { measuredAt: entry.measuredAt },
  });

  res.status(201).json(entry);
}

export async function uploadBodyProgressPhotoHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const image = await prepareImage(req.file, PHOTO_RENDITION);
  const file = await saveUserProgressPhotoFile(userId, image.buffer, image.mimeType);
  const record = await addBodyProgressPhoto(userId, file.storageKey, image.mimeType, file.bytes);

  await insertAudit({
    actorUserId: userId,
    entityType: "body_progress",
    action: "photo_uploaded",
    entityId: record.id,
    metadata: { bytes: file.bytes, mime: image.mimeType },
  });

  res.status(201).json({
    id: record.id,
    fileUrl: `/api/v1/users/me/body-progress/photo/${record.id}`,
    mimeType: image.mimeType,
    bytes: file.bytes,
    createdAt: record.createdAt,
  });
}

export async function getBodyProgressPhotoHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const photo = await getBodyProgressPhoto(userId, readRouteParam(req.params.id, "id"));
  if (!photo) {
    res.status(404).send("UPLOAD_NOT_FOUND");
    return;
  }

  try {
    const buffer = await readStorageObject(photo.storageKey);
    res.set("Content-Type", photo.mimeType ?? PHOTO_RENDITION.mimeType);
    res.set("Cache-Control", "private, max-age=300");
    res.send(buffer);
  } catch {
    res.status(404).send("UPLOAD_NOT_FOUND");
  }
}

export async function deleteBodyProgressPhotoHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const photo = await deleteBodyProgressPhoto(userId, readRouteParam(req.params.id, "id"));
  if (!photo) {
    res.status(404).json({ error: "UPLOAD_NOT_FOUND" });
    return;
  }

  await deleteStorageObject(photo.storageKey).catch(() => undefined);
  await insertAudit({
    actorUserId: userId,
    entityType: "body_progress",
    action: "photo_deleted",
    entityId: readRouteParam(req.params.id, "id"),
  });

  res.status(204).send();
}
