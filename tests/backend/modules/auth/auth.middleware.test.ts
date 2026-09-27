import type { NextFunction, Request, Response } from "express";
import * as authMiddleware from "../../../../apps/backend/src/modules/auth/auth.middleware.js";
import * as tokensService from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import * as authStateRepository from "../../../../apps/backend/src/modules/auth/auth.state.repository.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.state.repository.js");
jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: {
    ACCESS_COOKIE_NAME: "access_token",
  },
}));

const mockTokensService = jest.mocked(tokensService);
const mockAuthStateRepository = jest.mocked(authStateRepository);

describe("Auth Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStateRepository.isSessionActiveForUser.mockResolvedValue(true);

    mockRequest = {
      headers: {},
      cookies: {},
      user: undefined,
    };

    mockResponse = {};

    mockNext = jest.fn();
  });

  describe("requireAccessToken", () => {
    it("should authenticate user with token from cookie", async () => {
      const token = "access-token";
      const payload = {
        sub: "user-123",
        role: "athlete",
        sid: "session-123",
      };

      mockRequest.cookies = { access_token: token };
      mockTokensService.verifyAccess.mockReturnValue(payload as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should authenticate user with token from Authorization header", async () => {
      const token = "access-token";
      const payload = {
        sub: "user-123",
        role: "athlete",
        sid: "session-123",
      };

      mockRequest.headers = { authorization: "Bearer access-token" };
      mockTokensService.verifyAccess.mockReturnValue(payload as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should prefer cookie token over Authorization header", async () => {
      const cookieToken = "cookie-token";
      const headerToken = "header-token";
      const payload = {
        sub: "user-123",
        role: "athlete",
        sid: "session-123",
      };

      mockRequest.cookies = { access_token: cookieToken };
      mockRequest.headers = { authorization: `Bearer ${headerToken}` };
      mockTokensService.verifyAccess.mockReturnValue(payload as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).toHaveBeenCalledWith(cookieToken);
      expect(mockTokensService.verifyAccess).not.toHaveBeenCalledWith(headerToken);
    });

    it("should return error when no token is provided", async () => {
      mockRequest.cookies = {};
      mockRequest.headers = {};

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
          message: "Access token required",
        }),
      );
    });

    it("should return error when token is invalid", async () => {
      const token = "invalid-token";
      mockRequest.cookies = { access_token: token };
      mockTokensService.verifyAccess.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
          message: "Invalid or expired access token",
        }),
      );
    });

    it("should handle Authorization header with lowercase bearer", async () => {
      const token = "access-token";
      const payload = {
        sub: "user-123",
        role: "athlete",
        sid: "session-123",
      };

      mockRequest.headers = { authorization: "bearer access-token" };
      mockTokensService.verifyAccess.mockReturnValue(payload as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(payload);
    });

    it("should reject a valid JWT whose backing session is revoked or expired", async () => {
      const payload = { sub: "user-123", role: "athlete", sid: "session-123" };
      mockRequest.cookies = { access_token: "access-token" };
      mockTokensService.verifyAccess.mockReturnValue(payload as never);
      mockAuthStateRepository.isSessionActiveForUser.mockResolvedValue(false);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthStateRepository.isSessionActiveForUser).toHaveBeenCalledWith(
        "session-123",
        "user-123",
      );
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ code: "UNAUTHENTICATED", message: "Session revoked or expired" }),
      );
    });

    it("should return null when Authorization header has invalid format", async () => {
      mockRequest.headers = { authorization: "InvalidFormat token" };
      mockRequest.cookies = {};

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      );
    });

    it("should return null when Authorization header is missing value", async () => {
      mockRequest.headers = { authorization: "Bearer" };
      mockRequest.cookies = {};

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTokensService.verifyAccess).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      );
    });
  });
});
