import sharp from "sharp";
import { scanBuffer } from "../../../../apps/backend/src/services/antivirus.service.js";
import {
  deleteStorageObject,
  saveUserAvatarFile,
} from "../../../../apps/backend/src/services/mediaStorage.service.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import { saveUserAvatarMetadata } from "../../../../apps/backend/src/modules/users/users.avatar.repository.js";
import {
  auditRegistrationAvatar,
  cleanupRegistrationAvatar,
  persistRegistrationAvatar,
  prepareRegistrationAvatar,
} from "../../../../apps/backend/src/modules/auth/auth.registration-avatar.service.js";

jest.mock("../../../../apps/backend/src/services/antivirus.service.js");
jest.mock("../../../../apps/backend/src/services/mediaStorage.service.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");
jest.mock("../../../../apps/backend/src/modules/users/users.avatar.repository.js");
jest.mock("sharp");

const mockScanBuffer = jest.mocked(scanBuffer);
const mockSaveUserAvatarFile = jest.mocked(saveUserAvatarFile);
const mockDeleteStorageObject = jest.mocked(deleteStorageObject);
const mockInsertAudit = jest.mocked(insertAudit);
const mockSaveUserAvatarMetadata = jest.mocked(saveUserAvatarMetadata);
const mockSharp = jest.mocked(sharp);

const file = {
  buffer: Buffer.from("avatar"),
  mimetype: "image/png",
  originalname: "avatar.png",
  size: 1024,
};

function configureSharp(format: string | undefined = "png"): void {
  const instance = {
    metadata: jest.fn().mockResolvedValue({ format }),
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("processed")),
  };
  mockSharp.mockReturnValue(instance as never);
}

describe("registration avatar service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScanBuffer.mockResolvedValue({ isInfected: false, viruses: [] });
    mockSaveUserAvatarFile.mockResolvedValue({
      storageKey: "avatars/user-1/avatar.png",
      bytes: 512,
    });
    mockSaveUserAvatarMetadata.mockResolvedValue({
      previousKey: null,
      record: {
        id: "media-1",
        created_at: new Date().toISOString(),
      },
    });
    mockDeleteStorageObject.mockResolvedValue();
    mockInsertAudit.mockResolvedValue();
    configureSharp();
  });

  describe("prepareRegistrationAvatar", () => {
    it("rejects unsupported MIME types before scanning", async () => {
      await expect(
        prepareRegistrationAvatar({ ...file, mimetype: "application/pdf" }),
      ).rejects.toMatchObject({ status: 422, code: "UPLOAD_UNSUPPORTED_TYPE" });

      expect(mockScanBuffer).not.toHaveBeenCalled();
    });

    it("rejects files larger than the upload limit", async () => {
      await expect(
        prepareRegistrationAvatar({ ...file, size: 5 * 1024 * 1024 + 1 }),
      ).rejects.toMatchObject({ status: 422, code: "UPLOAD_TOO_LARGE" });

      expect(mockScanBuffer).not.toHaveBeenCalled();
    });

    it("rejects malware detected by ClamAV", async () => {
      mockScanBuffer.mockResolvedValue({
        isInfected: true,
        viruses: ["Eicar-Test-Signature"],
      });

      await expect(prepareRegistrationAvatar(file)).rejects.toMatchObject({
        status: 422,
        code: "E.UPLOAD.MALWARE_DETECTED",
      });

      expect(mockSharp).not.toHaveBeenCalled();
    });

    it("rejects data that Sharp cannot decode", async () => {
      mockSharp.mockReturnValue({
        metadata: jest.fn().mockRejectedValue(new Error("invalid image")),
      } as never);

      await expect(prepareRegistrationAvatar(file)).rejects.toMatchObject({
        status: 422,
        code: "UPLOAD_UNSUPPORTED_TYPE",
      });
    });

    it("rejects decoded image formats outside the supported set", async () => {
      configureSharp("gif");

      await expect(prepareRegistrationAvatar(file)).rejects.toMatchObject({
        status: 422,
        code: "UPLOAD_UNSUPPORTED_TYPE",
      });
    });

    it("scans and normalizes a clean image to 128x128 PNG", async () => {
      const processed = await prepareRegistrationAvatar(file);

      expect(mockScanBuffer).toHaveBeenCalledWith(file.buffer, file.originalname);
      const sharpInstance = mockSharp.mock.results[1]?.value ?? mockSharp.mock.results[0]?.value;
      expect(sharpInstance.resize).toHaveBeenCalledWith(128, 128, { fit: "cover" });
      expect(sharpInstance.png).toHaveBeenCalledWith({ quality: 80 });
      expect(processed).toEqual(Buffer.from("processed"));
    });
  });

  describe("persistRegistrationAvatar", () => {
    it("stores the processed file and avatar metadata in the caller transaction", async () => {
      const trx = {} as never;

      await expect(
        persistRegistrationAvatar("user-1", Buffer.from("processed"), trx),
      ).resolves.toEqual({
        storageKey: "avatars/user-1/avatar.png",
        bytes: 512,
        recordId: "media-1",
      });

      expect(mockSaveUserAvatarFile).toHaveBeenCalledWith(
        "user-1",
        Buffer.from("processed"),
        "image/png",
      );
      expect(mockSaveUserAvatarMetadata).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          fileUrl: "/api/v1/users/avatar/user-1",
          mimeType: "image/png",
          bytes: 512,
        }),
        trx,
      );
    });

    it("deletes the stored file if metadata persistence fails", async () => {
      const error = new Error("metadata failed");
      mockSaveUserAvatarMetadata.mockRejectedValue(error);

      await expect(
        persistRegistrationAvatar("user-1", Buffer.from("processed"), {} as never),
      ).rejects.toBe(error);

      expect(mockDeleteStorageObject).toHaveBeenCalledWith("avatars/user-1/avatar.png");
    });
  });

  it("audits a persisted registration avatar", async () => {
    await auditRegistrationAvatar("user-1", {
      storageKey: "avatars/user-1/avatar.png",
      bytes: 512,
      recordId: "media-1",
    });

    expect(mockInsertAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        entityType: "user_media",
        action: "avatar_upload",
        entityId: "media-1",
        metadata: expect.objectContaining({ source: "registration" }),
      }),
    );
  });

  describe("cleanupRegistrationAvatar", () => {
    it("removes a persisted avatar when cleanup is required", async () => {
      await cleanupRegistrationAvatar({
        storageKey: "avatars/user-1/avatar.png",
        bytes: 512,
        recordId: "media-1",
      });

      expect(mockDeleteStorageObject).toHaveBeenCalledWith("avatars/user-1/avatar.png");
    });

    it("does nothing when there is no persisted avatar", async () => {
      await cleanupRegistrationAvatar(null);

      expect(mockDeleteStorageObject).not.toHaveBeenCalled();
    });

    it("suppresses storage cleanup errors", async () => {
      mockDeleteStorageObject.mockRejectedValue(new Error("delete failed"));

      await expect(
        cleanupRegistrationAvatar({
          storageKey: "avatars/user-1/avatar.png",
          bytes: 512,
          recordId: "media-1",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
