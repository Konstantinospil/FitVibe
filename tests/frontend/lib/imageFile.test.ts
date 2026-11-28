import { describe, expect, it } from "vitest";
import { IMAGE_UPLOAD_CONFIG } from "../../src/config/media";
import {
  IMAGE_FILE_ACCEPT,
  imageFileProblem,
  readImagePreview,
} from "../../src/lib/media/imageFile";
import { apiErrorCode } from "../../src/services/httpApi";
import { photoUploadErrorKey } from "../../src/lib/sessions/workoutPhoto";

describe("image files", () => {
  it("accepts the server's image types up to the size limit", () => {
    expect(IMAGE_FILE_ACCEPT).toBe("image/jpeg,image/png,image/webp");
    expect(imageFileProblem({ type: "image/webp", size: IMAGE_UPLOAD_CONFIG.maxBytes })).toBeNull();
    expect(imageFileProblem({ type: "image/gif", size: 1 })).toBe("invalidType");
    expect(imageFileProblem({ type: "image/png", size: IMAGE_UPLOAD_CONFIG.maxBytes + 1 })).toBe(
      "tooLarge",
    );
  });

  it("previews a chosen image as a data URL", async () => {
    const preview = await readImagePreview(new Blob([new Uint8Array([1])], { type: "image/png" }));
    expect(preview.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("photo upload errors", () => {
  // axios.isAxiosError only checks this flag.
  const failed = (data: unknown) =>
    Object.assign(new Error("failed"), { isAxiosError: true, response: { status: 422, data } });

  it("reads both error shapes the API answers with", () => {
    expect(apiErrorCode(failed({ error: { code: "E.UPLOAD.MALWARE_DETECTED" } }))).toBe(
      "E.UPLOAD.MALWARE_DETECTED",
    );
    expect(apiErrorCode(failed({ error: "UPLOAD_TOO_LARGE" }))).toBe("UPLOAD_TOO_LARGE");
    expect(apiErrorCode(new Error("offline"))).toBeNull();
  });

  it("names the reason when the server gave one", () => {
    expect(photoUploadErrorKey(failed({ error: "UPLOAD_TOO_LARGE" }))).toBe(
      "workoutResult.photo.tooLarge",
    );
    expect(photoUploadErrorKey(failed({ error: { code: "UPLOAD_UNSUPPORTED_TYPE" } }))).toBe(
      "workoutResult.photo.invalidType",
    );
    expect(photoUploadErrorKey(new Error("offline"))).toBe("workoutResult.photo.uploadError");
  });
});
