import type { Request, Response } from "express";
import sharp from "sharp";
import * as avatarController from "../../../../apps/backend/src/modules/users/users.avatar.controller.js";
import * as avatarRepository from "../../../../apps/backend/src/modules/users/users.avatar.repository.js";
import * as mediaStorageService from "../../../../apps/backend/src/services/mediaStorage.service.js";
import * as antivirusService from "../../../../apps/backend/src/services/antivirus.service.js";
import * as auditUtil from "../../../../apps/backend/src/modules/common/audit.util.js";
import * as idempotencyService from "../../../../apps/backend/src/modules/common/idempotency.service.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/users/users.avatar.repository.js");
jest.mock("../../../../apps/backend/src/services/mediaStorage.service.js");
jest.mock("../../../../apps/backend/src/services/antivirus.service.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");
jest.mock("../../../../apps/backend/src/modules/common/idempotency.service.js");
jest.mock("sharp");

const mockAvatarRepo = jest.mocked(avatarRepository);
const mockMediaStorage = jest.mocked(mediaStorageService);
const mockAntivirus = jest.mocked(antivirusService);
const mockAudit = jest.mocked(auditUtil);
const mockIdempotencyService = jest.mocked(idempotencyService);
const mockSharp = jest.mocked(sharp);

describe("Users Avatar Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "user-123";

  beforeEach(() => {
    mockRequest = {
      user: { sub: userId },
      params: { id: userId },
      file: {
        buffer: Buffer.from("fake-image-data"),
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      },
      headers: {},
      method: "POST",
      get: jest.fn((headerName: string) => {
        return (mockRequest.headers as Record<string, string>)?.[headerName.toLowerCase()];
      }) as unknown as Request["get"],
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();

    // Default mocks
    mockIdempotencyService.resolveIdempotency.mockResolvedValue({
      type: "new",
      recordId: "rec-1",
    });
    mockIdempotencyService.persistIdempotencyResult.mockResolvedValue();
    mockAntivirus.scanBuffer.mockResolvedValue({
      isInfected: false,
      viruses: [],
    });
    mockMediaStorage.saveUserAvatarFile.mockResolvedValue({
      storageKey: "storage-key-123",
      bytes: 512,
    });
    mockAvatarRepo.saveUserAvatarMetadata.mockResolvedValue({
      previousKey: null,
      record: {
        id: "avatar-123",
        created_at: new Date().toISOString(),
      },
    });
    mockAudit.insertAudit.mockResolvedValue();

    // Mock sharp
    const mockSharpInstance = {
      metadata: jest.fn().mockResolvedValue({ format: "jpeg" }),
      rotate: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from("processed-image")),
    };
    mockSharp.mockReturnValue(mockSharpInstance as never);
  });

  describe("uploadAvatarHandler", () => {
    it("should return 422 when no file is provided", async () => {
      mockRequest.file = undefined;

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "UPLOAD_NO_FILE" });
    });

    it("should return 422 when file type is not allowed", async () => {
      mockRequest.file = {
        ...mockRequest.file!,
        mimetype: "application/pdf",
      };

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "UPLOAD_UNSUPPORTED_TYPE" });
    });

    it("should return 422 when file is too large", async () => {
      mockRequest.file = {
        ...mockRequest.file!,
        size: 6 * 1024 * 1024, // 6 MB > 5 MB limit
      };

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "UPLOAD_TOO_LARGE" });
    });

    it("should upload avatar successfully without idempotency key", async () => {
      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAntivirus.scanBuffer).toHaveBeenCalled();
      expect(mockSharp().resize).toHaveBeenCalledWith(128, 128, { fit: "cover" });
      expect(mockMediaStorage.saveUserAvatarFile).toHaveBeenCalled();
      expect(mockAvatarRepo.saveUserAvatarMetadata).toHaveBeenCalled();
      expect(mockAudit.insertAudit).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it("should handle idempotency replay", async () => {
      const idempotencyKey = "idempotency-key-123";
      mockRequest.headers = { "idempotency-key": idempotencyKey };
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 201,
        body: { success: true, fileUrl: "/users/avatar/user-123" },
      });

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockAntivirus.scanBuffer).not.toHaveBeenCalled();
    });

    it("should reject infected file", async () => {
      mockAntivirus.scanBuffer.mockResolvedValue({
        isInfected: true,
        viruses: ["Test.Virus"],
      });

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "E.UPLOAD.MALWARE_DETECTED",
          }),
        }),
      );
      expect(mockAudit.insertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "avatar_upload_rejected",
        }),
      );
    });

    it("should delete previous avatar when replacing", async () => {
      const previousKey = "previous-storage-key";
      mockAvatarRepo.saveUserAvatarMetadata.mockResolvedValue({
        previousKey,
        record: {
          id: "avatar-123",
          created_at: new Date().toISOString(),
        },
      });
      mockMediaStorage.deleteStorageObject.mockResolvedValue();

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockMediaStorage.deleteStorageObject).toHaveBeenCalledWith(previousKey);
    });

    it("should handle deleteStorageObject failure gracefully", async () => {
      const previousKey = "previous-storage-key";
      mockAvatarRepo.saveUserAvatarMetadata.mockResolvedValue({
        previousKey,
        record: {
          id: "avatar-123",
          created_at: new Date().toISOString(),
        },
      });
      mockMediaStorage.deleteStorageObject.mockRejectedValue(new Error("Delete failed"));

      // Should not throw
      await expect(
        avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response),
      ).resolves.not.toThrow();
    });

    it("should persist idempotency result on success", async () => {
      const idempotencyKey = "idempotency-key-123";
      const recordId = "rec-1";
      mockRequest.headers = { "idempotency-key": idempotencyKey };
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId,
      });

      await avatarController.uploadAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        recordId,
        201,
        expect.any(Object),
      );
    });
  });

  describe("getAvatarHandler", () => {
    it("should return 404 when avatar not found", async () => {
      mockAvatarRepo.getUserAvatarMetadata.mockResolvedValue(null);

      await avatarController.getAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith("UPLOAD_NOT_FOUND");
    });

    it("should return avatar file when found", async () => {
      const mockMetadata = {
        id: "avatar-123",
        storage_key: "storage-key-123",
        mime_type: "image/png",
      };
      const mockBuffer = Buffer.from("avatar-data");

      mockAvatarRepo.getUserAvatarMetadata.mockResolvedValue(mockMetadata as never);
      mockMediaStorage.readStorageObject.mockResolvedValue(mockBuffer);

      await avatarController.getAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockMediaStorage.readStorageObject).toHaveBeenCalledWith("storage-key-123");
      expect(mockResponse.set).toHaveBeenCalledWith("Content-Type", "image/png");
      expect(mockResponse.set).toHaveBeenCalledWith("Cache-Control", "private, max-age=300");
      expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
    });

    it("should return 404 when storage read fails", async () => {
      const mockMetadata = {
        id: "avatar-123",
        storage_key: "storage-key-123",
        mime_type: "image/png",
      };

      mockAvatarRepo.getUserAvatarMetadata.mockResolvedValue(mockMetadata as never);
      mockMediaStorage.readStorageObject.mockRejectedValue(new Error("Read failed"));

      await avatarController.getAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith("UPLOAD_NOT_FOUND");
    });
  });

  describe("deleteAvatarHandler", () => {
    it("should delete avatar successfully without idempotency key", async () => {
      const mockMetadata = {
        id: "avatar-123",
        storage_key: "storage-key-123",
      };

      mockAvatarRepo.deleteUserAvatarMetadata.mockResolvedValue(mockMetadata as never);
      mockMediaStorage.deleteStorageObject.mockResolvedValue();
      mockAudit.insertAudit.mockResolvedValue();

      await avatarController.deleteAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAvatarRepo.deleteUserAvatarMetadata).toHaveBeenCalledWith(userId);
      expect(mockMediaStorage.deleteStorageObject).toHaveBeenCalledWith("storage-key-123");
      expect(mockAudit.insertAudit).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });

    it("should handle idempotency replay for delete", async () => {
      const idempotencyKey = "idempotency-key-123";
      mockRequest.headers = { "idempotency-key": idempotencyKey };
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 204,
        body: null,
      });

      await avatarController.deleteAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockAvatarRepo.deleteUserAvatarMetadata).not.toHaveBeenCalled();
    });

    it("should handle delete when no metadata exists", async () => {
      mockAvatarRepo.deleteUserAvatarMetadata.mockResolvedValue(null);

      await avatarController.deleteAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockMediaStorage.deleteStorageObject).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });

    it("should handle deleteStorageObject failure gracefully", async () => {
      const mockMetadata = {
        id: "avatar-123",
        storage_key: "storage-key-123",
      };

      mockAvatarRepo.deleteUserAvatarMetadata.mockResolvedValue(mockMetadata as never);
      mockMediaStorage.deleteStorageObject.mockRejectedValue(new Error("Delete failed"));

      // Should not throw
      await expect(
        avatarController.deleteAvatarHandler(mockRequest as Request, mockResponse as Response),
      ).resolves.not.toThrow();
    });

    it("should persist idempotency result on delete", async () => {
      const idempotencyKey = "idempotency-key-123";
      const recordId = "rec-1";
      const mockMetadata = {
        id: "avatar-123",
        storage_key: "storage-key-123",
      };
      mockRequest.headers = { "idempotency-key": idempotencyKey };
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId,
      });
      mockAvatarRepo.deleteUserAvatarMetadata.mockResolvedValue(mockMetadata as never);
      mockMediaStorage.deleteStorageObject.mockResolvedValue();

      await avatarController.deleteAvatarHandler(mockRequest as Request, mockResponse as Response);

      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        recordId,
        204,
        null,
      );
    });
  });
});
