/**
 * Image uploads (ADR-004, ADR-044): the one place that decides which images are
 * accepted, how large they may be, and how they are checked and re-encoded before
 * storage. Avatars, body-progress photos and workout photos all go through here.
 *
 * Every accepted image is scanned for malware, decoded to prove it is the format it
 * claims, and re-encoded, so metadata (including location) is never stored.
 */
import type { RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { HttpError } from "../utils/http.js";
import { scanBuffer } from "./antivirus.service.js";

const BYTES_PER_MEBIBYTE = 1024 * 1024;

/** Upload size cap from the PRD; the frontend mirrors it in config/media.ts. */
export const IMAGE_UPLOAD_LIMITS = { maxBytes: 5 * BYTES_PER_MEBIBYTE } as const;

/** MIME types a client may send; "image/jpg" is a common non-standard alias. */
export const ACCEPTED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/** Formats the decoder must find in the bytes, whatever the declared type. */
const ACCEPTED_IMAGE_FORMATS: ReadonlySet<string> = new Set(["jpeg", "png", "webp"]);

/** Error codes returned for a rejected image (the HttpError code and message). */
export const IMAGE_UPLOAD_ERRORS = {
  noFile: "UPLOAD_NO_FILE",
  unsupportedType: "UPLOAD_UNSUPPORTED_TYPE",
  tooLarge: "UPLOAD_TOO_LARGE",
  invalid: "UPLOAD_INVALID",
  malware: "E.UPLOAD.MALWARE_DETECTED",
} as const;

export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** How an accepted image is stored. */
export interface ImageRendition {
  mimeType: "image/png" | "image/jpeg";
  encode: (image: sharp.Sharp) => sharp.Sharp;
}

const AVATAR_EDGE_PX = 128;
const AVATAR_PNG_QUALITY = 80;
/** Longest edge of a stored photo; larger photos are scaled down. */
export const PHOTO_MAX_EDGE_PX = 1600;
const PHOTO_JPEG_QUALITY = 85;

/** A small square profile picture. */
export const AVATAR_RENDITION: ImageRendition = {
  mimeType: "image/png",
  encode: (image) =>
    image
      .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, { fit: "cover" })
      .png({ quality: AVATAR_PNG_QUALITY }),
};

/** A photo kept at its aspect ratio, never enlarged. */
export const PHOTO_RENDITION: ImageRendition = {
  mimeType: "image/jpeg",
  encode: (image) =>
    image
      .resize({
        width: PHOTO_MAX_EDGE_PX,
        height: PHOTO_MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: PHOTO_JPEG_QUALITY }),
};

/** The code for a file that fails the cheap checks, or null when it passes them. */
export function imageFileProblem(
  file: UploadedImageFile | undefined,
): (typeof IMAGE_UPLOAD_ERRORS)[keyof typeof IMAGE_UPLOAD_ERRORS] | null {
  if (!file) {
    return IMAGE_UPLOAD_ERRORS.noFile;
  }
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return IMAGE_UPLOAD_ERRORS.unsupportedType;
  }
  if (file.size > IMAGE_UPLOAD_LIMITS.maxBytes) {
    return IMAGE_UPLOAD_ERRORS.tooLarge;
  }
  return null;
}

const rejected = (code: string) => new HttpError(422, code, code);

/**
 * Checks, scans and re-encodes an uploaded image. Throws a 422 HttpError whose code
 * is one of IMAGE_UPLOAD_ERRORS; malware carries the virus names in its details.
 */
export async function prepareImage(
  file: UploadedImageFile | undefined,
  rendition: ImageRendition,
): Promise<{ buffer: Buffer; mimeType: ImageRendition["mimeType"] }> {
  const problem = imageFileProblem(file);
  if (problem || !file) {
    throw rejected(problem ?? IMAGE_UPLOAD_ERRORS.noFile);
  }

  const scan = await scanBuffer(file.buffer, file.originalname);
  if (scan.isInfected) {
    throw new HttpError(422, IMAGE_UPLOAD_ERRORS.malware, "UPLOAD_MALWARE_DETECTED", {
      reason: "malware_detected",
      viruses: scan.viruses,
    });
  }

  let format: string | undefined;
  try {
    format = (await sharp(file.buffer).metadata()).format;
  } catch {
    throw rejected(IMAGE_UPLOAD_ERRORS.unsupportedType);
  }
  if (!format || !ACCEPTED_IMAGE_FORMATS.has(format)) {
    throw rejected(IMAGE_UPLOAD_ERRORS.unsupportedType);
  }

  try {
    const buffer = await rendition.encode(sharp(file.buffer).rotate()).toBuffer();
    return { buffer, mimeType: rendition.mimeType };
  } catch {
    // Decoding can fail even when the image metadata is readable.
    throw rejected(IMAGE_UPLOAD_ERRORS.unsupportedType);
  }
}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_LIMITS.maxBytes },
});

/**
 * Reads one image from a multipart field into memory. An oversized or malformed
 * upload answers 422 with UPLOAD_TOO_LARGE or UPLOAD_INVALID.
 */
export function singleImageUpload(field: string): RequestHandler {
  const read = parser.single(field);
  return (req, res, next) => {
    read(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        res.status(422).json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? IMAGE_UPLOAD_ERRORS.tooLarge
              : IMAGE_UPLOAD_ERRORS.invalid,
        });
        return;
      }
      next(error);
    });
  };
}
