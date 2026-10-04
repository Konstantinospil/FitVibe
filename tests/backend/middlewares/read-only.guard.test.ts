import type { NextFunction, Request, Response } from "express";
import { readOnlyGuard } from "../../../apps/backend/src/middlewares/read-only.guard.js";
import { env } from "../../../apps/backend/src/config/env.js";
import { logger } from "../../../apps/backend/src/config/logger.js";
import {
  getRuntimeAppSetting,
  getRuntimeGovernanceState,
  isEffectiveReadOnly,
} from "../../../apps/backend/src/modules/system/app-settings.runtime.js";

// Mock env
jest.mock("../../../apps/backend/src/config/env.js", () => ({
  env: {
    readOnlyMode: false,
    maintenanceMessage: "System is in maintenance mode",
  },
}));

jest.mock("../../../apps/backend/src/modules/system/app-settings.runtime.js", () => ({
  getRuntimeAppSetting: jest.fn(),
  getRuntimeGovernanceState: jest.fn(),
  isEffectiveReadOnly: jest.fn(),
}));

// Mock logger
jest.mock("../../../apps/backend/src/config/logger.js", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockLogger = jest.mocked(logger);
const mockEnv = env as { NODE_ENV?: string; readOnlyMode: boolean; maintenanceMessage?: string };
const mockRuntimeAppSetting = jest.mocked(getRuntimeAppSetting);
const mockGovernanceState = jest.mocked(getRuntimeGovernanceState);
const mockIsEffectiveReadOnly = jest.mocked(isEffectiveReadOnly);

describe("Read-Only Guard", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.NODE_ENV = "development";
    mockEnv.readOnlyMode = false;
    mockEnv.maintenanceMessage = "System is in maintenance mode";
    mockIsEffectiveReadOnly.mockReturnValue(false);
    mockRuntimeAppSetting.mockReturnValue("System is in maintenance mode");
    mockGovernanceState.mockReturnValue({
      authorityReady: true,
      maintenanceEnabled: false,
      activeRevision: 0,
      loadedRevision: 0,
      emergencyReadOnly: false,
      settings: { "system.maintenance_message": "System is in maintenance mode" },
    });

    mockRequest = {
      method: "GET",
      path: "/api/v1/sessions",
      originalUrl: "/api/v1/sessions",
      ip: "127.0.0.1",
      user: undefined,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {},
    };

    mockNext = jest.fn();
  });

  describe("when read-only mode is disabled", () => {
    it("should allow all requests", () => {
      mockEnv.readOnlyMode = false;
      mockRequest.method = "POST";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe("when read-only mode is enabled", () => {
    beforeEach(() => {
      mockEnv.readOnlyMode = true;
      mockIsEffectiveReadOnly.mockReturnValue(true);
      mockGovernanceState.mockReturnValue({
        authorityReady: true,
        maintenanceEnabled: true,
        activeRevision: 0,
        loadedRevision: 0,
        emergencyReadOnly: false,
        settings: { "system.maintenance_message": "System is in maintenance mode" },
      });
    });

    it("should allow safe HTTP methods (GET)", () => {
      mockRequest.method = "GET";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should allow safe HTTP methods (HEAD)", () => {
      mockRequest.method = "HEAD";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow safe HTTP methods (OPTIONS)", () => {
      mockRequest.method = "OPTIONS";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should block POST requests", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/sessions";
      mockResponse.locals = { requestId: "req-123" };

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: "E.SYSTEM.READ_ONLY",
          message: "System is in maintenance mode",
          details: {
            readOnlyMode: true,
            method: "POST",
            path: "/api/v1/sessions",
            activeRevision: 0,
            loadedRevision: 0,
            emergencyReadOnly: false,
          },
          requestId: "req-123",
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: "/api/v1/sessions",
          ip: "127.0.0.1",
        }),
        "[read-only] Mutation request blocked",
      );
    });

    it("should block PUT requests", () => {
      mockRequest.method = "PUT";
      mockRequest.originalUrl = "/api/v1/sessions/123";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it("should block PATCH requests", () => {
      mockRequest.method = "PATCH";
      mockRequest.originalUrl = "/api/v1/sessions/123";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it("should block DELETE requests", () => {
      mockRequest.method = "DELETE";
      mockRequest.originalUrl = "/api/v1/sessions/123";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it("should allow health endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/health";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should allow metrics endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/metrics";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow JWKS endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/.well-known/jwks.json";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow read-only status endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/system/read-only/status";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should block obsolete read-only enable endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/system/read-only/enable";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it("should block obsolete read-only disable endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/system/read-only/disable";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it("should allow auth refresh endpoint", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/auth/refresh";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow auth refresh endpoint without API prefix", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/auth/refresh";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should include user ID in log when user is authenticated", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/sessions";
      mockRequest.user = { sub: "user-123", role: "user" };
      mockResponse.locals = { requestId: "req-456" };

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
        }),
        "[read-only] Mutation request blocked",
      );
    });

    it("should use the governed maintenance message", () => {
      mockRuntimeAppSetting.mockReturnValue("Governed maintenance");
      mockGovernanceState.mockReturnValue({
        authorityReady: true,
        maintenanceEnabled: true,
        activeRevision: 0,
        loadedRevision: 0,
        emergencyReadOnly: false,
        settings: { "system.maintenance_message": "Governed maintenance" },
      });
      mockRequest.method = "POST";
      mockRequest.originalUrl = "/api/v1/sessions";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: "Governed maintenance",
          }),
        }),
      );
    });

    it("should use path when originalUrl is not available", () => {
      mockRequest.method = "POST";
      mockRequest.originalUrl = undefined;
      mockRequest.path = "/api/v1/sessions";

      readOnlyGuard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.objectContaining({
              path: "/api/v1/sessions",
            }),
          }),
        }),
      );
    });
  });
});
