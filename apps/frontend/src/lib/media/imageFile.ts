import { IMAGE_UPLOAD_CONFIG } from "../../config/media";

/** Why a chosen file cannot be uploaded as an image. */
export type ImageFileProblem = "invalidType" | "tooLarge";

/** The value of a file input's `accept` attribute. */
export const IMAGE_FILE_ACCEPT = IMAGE_UPLOAD_CONFIG.acceptedTypes.join(",");

const ACCEPTED: ReadonlySet<string> = new Set(IMAGE_UPLOAD_CONFIG.acceptedTypes);

/** The problem with a chosen file, or null when the server should accept it. */
export function imageFileProblem(file: Pick<File, "type" | "size">): ImageFileProblem | null {
  if (!ACCEPTED.has(file.type)) {
    return "invalidType";
  }
  if (file.size > IMAGE_UPLOAD_CONFIG.maxBytes) {
    return "tooLarge";
  }
  return null;
}

/**
 * A data URL to preview a chosen image. Data URLs, not object URLs, because the
 * content security policy allows `data:` images but not `blob:`.
 */
export function readImagePreview(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Unreadable image"));
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable image"));
    reader.readAsDataURL(file);
  });
}
