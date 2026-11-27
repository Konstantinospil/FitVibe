const BYTES_PER_MEBIBYTE = 1024 * 1024;
const IMAGE_MAX_MEBIBYTES = 5;

/**
 * Images the server accepts (services/imageUpload.service.ts on the backend, which
 * enforces the same type list and size). Checked here first so a wrong file is
 * refused before it is uploaded.
 */
export const IMAGE_UPLOAD_CONFIG = {
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxMebibytes: IMAGE_MAX_MEBIBYTES,
  maxBytes: IMAGE_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE,
} as const;
