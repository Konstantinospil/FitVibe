import express from "express";
import request from "supertest";
import sharp from "sharp";
import { scanBuffer } from "../../../apps/backend/src/services/antivirus.service.js";
import {
  AVATAR_RENDITION,
  IMAGE_UPLOAD_ERRORS,
  IMAGE_UPLOAD_LIMITS,
  PHOTO_MAX_EDGE_PX,
  PHOTO_RENDITION,
  imageFileProblem,
  prepareImage,
  singleImageUpload,
  type UploadedImageFile,
} from "../../../apps/backend/src/services/imageUpload.service.js";
import { HttpError } from "../../../apps/backend/src/utils/http.js";

jest.mock("../../../apps/backend/src/services/antivirus.service.js");

const mockScanBuffer = jest.mocked(scanBuffer);

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png()
    .toBuffer();

const asFile = (buffer: Buffer, mimetype = "image/png"): UploadedImageFile => ({
  buffer,
  mimetype,
  originalname: "photo.png",
  size: buffer.length,
});

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    return error as HttpError;
  }
  throw new Error("expected the image to be rejected");
}

beforeEach(() => {
  mockScanBuffer.mockReset();
  mockScanBuffer.mockResolvedValue({ isInfected: false, viruses: [], scannedAt: new Date() });
});

describe("imageFileProblem", () => {
  it("names the first cheap check a file fails", () => {
    expect(imageFileProblem(undefined)).toBe(IMAGE_UPLOAD_ERRORS.noFile);
    expect(imageFileProblem(asFile(Buffer.from("x"), "application/pdf"))).toBe(
      IMAGE_UPLOAD_ERRORS.unsupportedType,
    );
    expect(
      imageFileProblem({ ...asFile(Buffer.from("x")), size: IMAGE_UPLOAD_LIMITS.maxBytes + 1 }),
    ).toBe(IMAGE_UPLOAD_ERRORS.tooLarge);
    expect(imageFileProblem(asFile(Buffer.from("x"), "image/jpg"))).toBeNull();
  });
});

describe("prepareImage", () => {
  it("re-encodes a photo as JPEG within the longest-edge limit, keeping its shape", async () => {
    const result = await prepareImage(
      asFile(await image(PHOTO_MAX_EDGE_PX * 2, PHOTO_MAX_EDGE_PX)),
      PHOTO_RENDITION,
    );
    const meta = await sharp(result.buffer).metadata();
    expect(result.mimeType).toBe("image/jpeg");
    expect(meta.format).toBe("jpeg");
    expect(meta.width! / meta.height!).toBe(2);
    expect(Math.max(meta.width!, meta.height!)).toBe(PHOTO_MAX_EDGE_PX);
  });

  it("never enlarges a small photo", async () => {
    const result = await prepareImage(asFile(await image(40, 30)), PHOTO_RENDITION);
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 40, height: 30 });
  });

  it("makes a square PNG avatar", async () => {
    const result = await prepareImage(asFile(await image(300, 200)), AVATAR_RENDITION);
    const meta = await sharp(result.buffer).metadata();
    expect(result.mimeType).toBe("image/png");
    expect(meta.width).toBe(meta.height);
  });

  it("rejects bytes that are not an image even when the declared type is allowed", async () => {
    const error = await rejection(
      prepareImage(asFile(Buffer.from("not an image")), PHOTO_RENDITION),
    );
    expect(error).toMatchObject({ status: 422, code: IMAGE_UPLOAD_ERRORS.unsupportedType });
  });

  it("rejects malware before decoding it, with the virus names", async () => {
    mockScanBuffer.mockResolvedValue({
      isInfected: true,
      viruses: ["Eicar-Test-Signature"],
      scannedAt: new Date(),
    });
    const error = await rejection(prepareImage(asFile(await image(10, 10)), PHOTO_RENDITION));
    expect(error).toMatchObject({ status: 422, code: IMAGE_UPLOAD_ERRORS.malware });
    expect(error.details).toMatchObject({ viruses: ["Eicar-Test-Signature"] });
  });

  it("does not scan a file that fails the cheap checks", async () => {
    const error = await rejection(prepareImage(undefined, PHOTO_RENDITION));
    expect(error.code).toBe(IMAGE_UPLOAD_ERRORS.noFile);
    expect(mockScanBuffer).not.toHaveBeenCalled();
  });
});

describe("singleImageUpload", () => {
  const app = express();
  app.post("/upload", singleImageUpload("photo"), (req, res) => {
    res.json({ size: req.file?.size ?? null });
  });

  it("reads the named field into memory", async () => {
    const response = await request(app)
      .post("/upload")
      .attach("photo", Buffer.from("abc"), "a.png");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ size: 3 });
  });

  it("answers 422 for a file over the limit or in another field", async () => {
    const tooLarge = await request(app)
      .post("/upload")
      .attach("photo", Buffer.alloc(IMAGE_UPLOAD_LIMITS.maxBytes + 1), "big.png");
    expect(tooLarge.status).toBe(422);
    expect(tooLarge.body).toEqual({ error: IMAGE_UPLOAD_ERRORS.tooLarge });

    const wrongField = await request(app)
      .post("/upload")
      .attach("other", Buffer.from("abc"), "a.png");
    expect(wrongField.status).toBe(422);
    expect(wrongField.body).toEqual({ error: IMAGE_UPLOAD_ERRORS.invalid });
  });
});
