import type { Request, Response } from "express";
import * as idempotencyHelpers from "../../../../apps/backend/src/modules/common/idempotency.helpers.js";
import * as idempotencyService from "../../../../apps/backend/src/modules/common/idempotency.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

jest.mock("../../../../apps/backend/src/modules/common/idempotency.service.js");

const mockIdempotencyService = jest.mocked(idempotencyService);

describe("idempotency.helpers", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "user-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { sub: userId, role: "athlete" },
      headers: {},
      get: jest.fn().mockReturnValue(null),
      method: "POST",
      baseUrl: "/api/v1",
      route: { path: "/sessions" },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
  });

  describe("getIdempotencyKey", () => {
    it("should return null when no header", () => {
      (mockRequest.get as jest.Mock).mockReturnValue(null);

      const result = idempotencyHelpers.getIdempotencyKey(mockRequest as Request);

      expect(result).toBeNull();
    });

    it("should return trimmed key when header present", () => {
      (mockRequest.get as jest.Mock).mockReturnValue("  key-123  ");

      const result = idempotencyHelpers.getIdempotencyKey(mockRequest as Request);

      expect(result).toBe("key-123");
    });

    it("should throw error for empty key", () => {
      (mockRequest.get as jest.Mock).mockReturnValue("   ");

      expect(() => idempotencyHelpers.getIdempotencyKey(mockRequest as Request)).toThrow(HttpError);
      try {
        idempotencyHelpers.getIdempotencyKey(mockRequest as Request);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe("E.IDEMPOTENCY.INVALID");
      }
    });

    it("should throw error for key too long", () => {
      const longKey = "a".repeat(201);
      (mockRequest.get as jest.Mock).mockReturnValue(longKey);

      expect(() => idempotencyHelpers.getIdempotencyKey(mockRequest as Request)).toThrow(HttpError);
      try {
        idempotencyHelpers.getIdempotencyKey(mockRequest as Request);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe("E.IDEMPOTENCY.INVALID");
      }
    });

    it("should accept key at max length", () => {
      const maxKey = "a".repeat(200);
      (mockRequest.get as jest.Mock).mockReturnValue(maxKey);

      const result = idempotencyHelpers.getIdempotencyKey(mockRequest as Request);

      expect(result).toBe(maxKey);
    });
  });

  describe("getRouteTemplate", () => {
    it("should return route template with baseUrl and route path", () => {
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = { path: "/sessions" };

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/api/v1/sessions");
    });

    it("should handle route without baseUrl", () => {
      mockRequest.baseUrl = "";
      mockRequest.route = { path: "/sessions" };

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/sessions");
    });

    it("should handle route without path", () => {
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = {};

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/api/v1");
    });

    it("should normalize double slashes", () => {
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = { path: "//sessions" };

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/api/v1/sessions");
    });

    it("should remove trailing slash", () => {
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = { path: "/sessions/" };

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/api/v1/sessions");
    });

    it("should return / when empty", () => {
      mockRequest.baseUrl = "";
      mockRequest.route = {};

      const result = idempotencyHelpers.getRouteTemplate(mockRequest as Request);

      expect(result).toBe("/");
    });
  });

  describe("requireAuthenticatedUser", () => {
    it("should return user ID when authenticated", () => {
      mockRequest.user = { sub: userId, role: "athlete" };

      const result = idempotencyHelpers.requireAuthenticatedUser(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toBe(userId);
    });

    it("should throw error when not authenticated", () => {
      mockRequest.user = undefined;

      expect(() =>
        idempotencyHelpers.requireAuthenticatedUser(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).toThrow(HttpError);
      try {
        idempotencyHelpers.requireAuthenticatedUser(
          mockRequest as Request,
          mockResponse as Response,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe("E.AUTH.REQUIRED");
      }
    });

    it("should throw error when user has no sub", () => {
      mockRequest.user = { role: "athlete" };

      expect(() =>
        idempotencyHelpers.requireAuthenticatedUser(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).toThrow(HttpError);
    });
  });

  describe("handleIdempotentRequest", () => {
    it("should return false when no idempotency key", async () => {
      (mockRequest.get as jest.Mock).mockReturnValue(null);

      const handler = jest.fn().mockResolvedValue({ status: 201, body: { id: "123" } });

      const result = await idempotencyHelpers.handleIdempotentRequest(
        mockRequest as Request,
        mockResponse as Response,
        userId,
        {},
        handler,
      );

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should handle idempotent request", async () => {
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-123");
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = { path: "/sessions" };
      mockRequest.method = "POST";

      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });

      const handler = jest.fn().mockResolvedValue({ status: 201, body: { id: "123" } });

      const result = await idempotencyHelpers.handleIdempotentRequest(
        mockRequest as Request,
        mockResponse as Response,
        userId,
        { title: "Test" },
        handler,
      );

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key-123");
      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        "record-123",
        201,
        { id: "123" },
      );
    });

    it("should preserve 204 semantics for new and replayed requests", async () => {
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-204");
      mockIdempotencyService.resolveIdempotency.mockResolvedValueOnce({
        type: "new",
        recordId: "record-204",
      });

      const handler = jest.fn().mockResolvedValue({ status: 204, body: null });

      await idempotencyHelpers.handleIdempotentRequest(
        mockRequest as Request,
        mockResponse as Response,
        userId,
        {},
        handler,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalledWith();
      expect(mockResponse.json).not.toHaveBeenCalled();

      jest.clearAllMocks();
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-204");
      mockIdempotencyService.resolveIdempotency.mockResolvedValueOnce({
        type: "replay",
        status: 204,
        body: null,
      });

      await idempotencyHelpers.handleIdempotentRequest(
        mockRequest as Request,
        mockResponse as Response,
        userId,
        {},
        handler,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalledWith();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject a concurrent request while the original is pending", async () => {
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-pending");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "pending",
        recordId: "record-pending",
      });

      const handler = jest.fn().mockResolvedValue({ status: 201, body: { id: "duplicate" } });

      await expect(
        idempotencyHelpers.handleIdempotentRequest(
          mockRequest as Request,
          mockResponse as Response,
          userId,
          { title: "Test" },
          handler,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "E.IDEMPOTENCY.IN_PROGRESS",
      });

      expect(handler).not.toHaveBeenCalled();
      expect(mockIdempotencyService.persistIdempotencyResult).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should replay idempotent request", async () => {
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-123");
      mockRequest.baseUrl = "/api/v1";
      mockRequest.route = { path: "/sessions" };
      mockRequest.method = "POST";

      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 201,
        body: { id: "123" },
      });

      const handler = jest.fn().mockResolvedValue({ status: 201, body: { id: "456" } });

      const result = await idempotencyHelpers.handleIdempotentRequest(
        mockRequest as Request,
        mockResponse as Response,
        userId,
        { title: "Test" },
        handler,
      );

      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key-123");
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ id: "123" });
    });
  });

});
