import { apiErrorCode } from "../../services/httpApi";
import type { ImageFileProblem } from "../media/imageFile";
import { IMAGE_UPLOAD_CONFIG } from "../../config/media";

/** Messages for a photo refused before upload (ADR-044). */
export const PHOTO_PROBLEM_KEYS: Record<ImageFileProblem, string> = {
  invalidType: "workoutResult.photo.invalidType",
  tooLarge: "workoutResult.photo.tooLarge",
};

/** Interpolation values every photo message may use. */
export const PHOTO_MESSAGE_VALUES = { size: IMAGE_UPLOAD_CONFIG.maxMebibytes } as const;

const SERVER_PHOTO_ERROR_KEYS: Record<string, string> = {
  UPLOAD_UNSUPPORTED_TYPE: PHOTO_PROBLEM_KEYS.invalidType,
  UPLOAD_TOO_LARGE: PHOTO_PROBLEM_KEYS.tooLarge,
  "E.UPLOAD.MALWARE_DETECTED": "workoutResult.photo.rejected",
};

/** The message for a failed upload, specific when the server said why. */
export function photoUploadErrorKey(error: unknown): string {
  return SERVER_PHOTO_ERROR_KEYS[apiErrorCode(error) ?? ""] ?? "workoutResult.photo.uploadError";
}

/**
 * Workouts whose photo failed to upload while finishing. The workout itself was
 * saved; the session page shows the notice once (ADR-044). Kept in memory only:
 * after a reload the photo is simply missing, which the page shows anyway.
 */
const failedPhotoUploads = new Set<string>();

export function markPhotoUploadFailed(sessionId: string): void {
  failedPhotoUploads.add(sessionId);
}

/** Whether finishing failed to upload this workout's photo; reading clears it. */
export function takePhotoUploadFailed(sessionId: string): boolean {
  return failedPhotoUploads.delete(sessionId);
}
