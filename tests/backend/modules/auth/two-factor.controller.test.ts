import type { Request, Response } from "express";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import {
  disable,
  enable,
  regenerateBackups,
  restartSetup,
  setup,
  status,
  verify,
} from "../../../../apps/backend/src/modules/auth/two-factor.controller.js";

jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js", () => ({
  beginTwoFactorSetup: jest.fn(),
  enableTwoFactor: jest.fn(),
  disableTwoFactor: jest.fn(),
  regenerateTwoFactorBackupCodes: jest.fn(),
  restartTwoFactorSetup: jest.fn(),
  getTwoFactorStatus: jest.fn(),
}));

const serviceMocks = jest.requireMock(
  "../../../../apps/backend/src/modules/auth/two-factor.service.js",
);

const createResponse = () => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response & { status: jest.Mock; json: jest.Mock };
};

const createRequest = (overrides: Partial<Request> = {}): Request => {
  const req: Partial<Request> = {
    user: { sub: "user-123", role: "athlete" } as never,
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  return req as Request;
};

describe("two-factor controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("setup", () => {
    it("requires authentication", async () => {
      const req = createRequest({ user: undefined });
      const res = createResponse();
      const next = jest.fn();

      await setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(HttpError));
      expect(serviceMocks.beginTwoFactorSetup).not.toHaveBeenCalled();
    });

    it("starts setup through the canonical service", async () => {
      serviceMocks.beginTwoFactorSetup.mockResolvedValue({
        secret: "secret",
        qrCode: "qr",
        backupCodes: ["backup-1", "backup-2"],
      });
      const req = createRequest();
      const res = createResponse();
      const next = jest.fn();

      await setup(req, res, next);

      expect(serviceMocks.beginTwoFactorSetup).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: "secret",
          qrCode: "qr",
          backupCodes: ["backup-1", "backup-2"],
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("restart setup", () => {
    it("requires step-up credentials and delegates replacement to the service", async () => {
      serviceMocks.restartTwoFactorSetup.mockResolvedValue({
        secret: "secret-2",
        qrCode: "qr-2",
        backupCodes: ["backup-1"],
      });
      const req = createRequest({ body: { password: "StrongPassword123!", code: "123456" } });
      const res = createResponse();
      const next = jest.fn();

      await restartSetup(req, res, next);

      expect(serviceMocks.restartTwoFactorSetup).toHaveBeenCalledWith(
        "user-123",
        "StrongPassword123!",
        "123456",
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ secret: "secret-2" }));
    });
  });

  describe("verify", () => {
    it("validates the six-digit setup code", async () => {
      const req = createRequest({ body: { code: "123" } });
      const res = createResponse();
      const next = jest.fn();

      await verify(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(HttpError));
      expect(serviceMocks.enableTwoFactor).not.toHaveBeenCalled();
    });

    it("verifies the stored secret and enables 2FA", async () => {
      serviceMocks.enableTwoFactor.mockResolvedValue(true);
      const req = createRequest({ body: { code: "123456" } });
      const res = createResponse();
      const next = jest.fn();

      await verify(req, res, next);

      expect(serviceMocks.enableTwoFactor).toHaveBeenCalledWith("user-123", "123456");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Two-factor authentication enabled successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("enable compatibility route", () => {
    it("accepts the legacy token field but uses the canonical enable flow", async () => {
      serviceMocks.enableTwoFactor.mockResolvedValue(true);
      const req = createRequest({ body: { token: "654321" } });
      const res = createResponse();
      const next = jest.fn();

      await enable(req, res, next);

      expect(serviceMocks.enableTwoFactor).toHaveBeenCalledWith("user-123", "654321");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe("disable", () => {
    it("requires the current password and delegates verification to the service", async () => {
      serviceMocks.disableTwoFactor.mockResolvedValue();
      const req = createRequest({ body: { password: "StrongPassword123!", code: "123456" } });
      const res = createResponse();
      const next = jest.fn();

      await disable(req, res, next);

      expect(serviceMocks.disableTwoFactor).toHaveBeenCalledWith(
        "user-123",
        "StrongPassword123!",
        "123456",
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Two-factor authentication disabled successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards service errors", async () => {
      serviceMocks.disableTwoFactor.mockRejectedValue(
        new HttpError(404, "E.USER.NOT_FOUND", "User not found"),
      );
      const req = createRequest({ body: { password: "StrongPassword123!" } });
      const res = createResponse();
      const next = jest.fn();

      await disable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    });
  });

  describe("backup codes", () => {
    it("regenerates backup codes through the canonical service", async () => {
      serviceMocks.regenerateTwoFactorBackupCodes.mockResolvedValue(["code-1", "code-2"]);
      const req = createRequest({ body: { password: "StrongPassword123!", code: "123456" } });
      const res = createResponse();
      const next = jest.fn();

      await regenerateBackups(req, res, next);

      expect(serviceMocks.regenerateTwoFactorBackupCodes).toHaveBeenCalledWith(
        "user-123",
        "StrongPassword123!",
        "123456",
      );
      expect(res.json).toHaveBeenCalledWith({
        message: "Backup codes regenerated successfully",
        backupCodes: ["code-1", "code-2"],
      });
    });
  });

  describe("status", () => {
    it("returns the persisted 2FA status contract", async () => {
      serviceMocks.getTwoFactorStatus.mockResolvedValue({
        enabled: true,
        enabledAt: "2026-09-20T10:00:00.000Z",
        backupCodesRemaining: 5,
      });
      const req = createRequest();
      const res = createResponse();
      const next = jest.fn();

      await status(req, res, next);

      expect(serviceMocks.getTwoFactorStatus).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({
        enabled: true,
        enabledAt: "2026-09-20T10:00:00.000Z",
        backupCodesRemaining: 5,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
