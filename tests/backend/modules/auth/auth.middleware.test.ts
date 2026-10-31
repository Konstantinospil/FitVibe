import type { NextFunction, Request, Response } from "express";
import * as authMiddleware from "../../../../apps/backend/src/modules/auth/auth.middleware.js";
import * as tokensService from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import * as authStateRepository from "../../../../apps/backend/src/modules/auth/auth.state.repository.js";
import { db } from "../../../../apps/backend/src/db/connection.js";
import { is2FAEnabled } from "../../../../apps/backend/src/modules/auth/two-factor.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.state.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/two-factor.service.js", () => ({
  is2FAEnabled: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: {
    ACCESS_COOKIE_NAME: "access_token",
  },
}));

const mockTokensService = jest.mocked(tokensService);
const mockAuthStateRepository = jest.mocked(authStateRepository);
const mockIs2FAEnabled = jest.mocked(is2FAEnabled);
const mockDb = db as unknown as jest.Mock;
const mockRoleLookup = jest.fn();

describe("Auth Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStateRepository.isSessionActiveForUser.mockResolvedValue(true);
    mockAuthStateRepository.checkAndTouchPrivilegedSession.mockResolvedValue(true);
    // #557: run the real MFA guard with a realistic database role lookup.
    // The persisted role overrides stale role claims in issued access tokens.
    mockRoleLookup.mockResolvedValue({ role_code: "athlete", status: "active" });
    mockDb.mockReturnValue({
      where: jest.fn().mockReturnValue({ first: mockRoleLookup }),
    });
    mockIs2FAEnabled.mockResolvedValue(false);

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

    it("blocks password-only admin access to protected routes", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
      mockRequest.cookies = { access_token: "admin-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "admin-123",
        role: "admin",
        sid: "admin-session",
        mfa: false,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockDb).toHaveBeenCalledWith("users");
      expect(mockRoleLookup).toHaveBeenCalledWith(["role_code", "status"]);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ADMIN_2FA_REQUIRED" }),
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockIs2FAEnabled).not.toHaveBeenCalled();
    });

    it("blocks a newly promoted admin using an old athlete token", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
      mockRequest.cookies = { access_token: "pre-promotion-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "promoted-user",
        role: "athlete",
        sid: "existing-session",
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ADMIN_2FA_REQUIRED" }),
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("allows a verified superadmin with server-enabled TOTP", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "superadmin", status: "active" });
      mockIs2FAEnabled.mockResolvedValue(true);
      mockRequest.cookies = { access_token: "mfa-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "superadmin-123",
        role: "superadmin",
        sid: "verified-session",
        mfa: true,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockIs2FAEnabled).toHaveBeenCalledWith("superadmin-123");
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("blocks stale MFA claims when server-side TOTP is disabled", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
      mockRequest.cookies = { access_token: "stale-mfa-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "admin-123",
        role: "admin",
        sid: "existing-session",
        mfa: true,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockIs2FAEnabled).toHaveBeenCalledWith("admin-123");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ADMIN_2FA_REQUIRED" }),
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("rejects expired administrator sessions even with verified MFA", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
      mockAuthStateRepository.checkAndTouchPrivilegedSession.mockResolvedValue(false);
      mockIs2FAEnabled.mockResolvedValue(true);
      mockRequest.cookies = { access_token: "expired-admin-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "admin-123", role: "admin", sid: "expired-session", mfa: true,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request, mockResponse as Response, mockNext,
      );

      expect(mockAuthStateRepository.checkAndTouchPrivilegedSession)
        .toHaveBeenCalledWith("expired-session", "admin-123");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401, code: "AUTH_SESSION_EXPIRED" }),
      );
      expect(mockNext).not.toHaveBeenCalledWith();
    });

    it("allows MFA enrollment status before verification", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
      mockRequest.cookies = { access_token: "enrollment-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/auth/2fa/status?from=enrollment";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "admin-123",
        role: "admin",
        sid: "enrollment-session",
        mfa: false,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("rejects inactive accounts even with a valid session and MFA", async () => {
      mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "suspended" });
      mockRequest.cookies = { access_token: "still-valid-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "suspended-user", role: "admin", sid: "old-session", mfa: true,
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request, mockResponse as Response, mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401, code: "UNAUTHENTICATED" }),
      );
      expect(mockIs2FAEnabled).not.toHaveBeenCalled();
    });

    it("fails closed when the authenticated identity has no persisted user", async () => {
      mockRoleLookup.mockResolvedValue(undefined);
      mockRequest.cookies = { access_token: "orphaned-user-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "deleted-user",
        role: "athlete",
        sid: "still-active-session",
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockDb).toHaveBeenCalledWith("users");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401, code: "UNAUTHENTICATED" }),
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockIs2FAEnabled).not.toHaveBeenCalled();
    });

    it("fails closed when the persisted user role cannot be retrieved", async () => {
      const lookupError = new Error("Role database unavailable");
      mockRoleLookup.mockRejectedValue(lookupError);
      mockRequest.cookies = { access_token: "valid-token" };
      mockRequest.method = "GET";
      mockRequest.originalUrl = "/api/v1/workouts";
      mockTokensService.verifyAccess.mockReturnValue({
        sub: "user-123",
        role: "athlete",
        sid: "session-123",
      } as never);

      await authMiddleware.authenticateAccessToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(lookupError);
      expect(mockNext).toHaveBeenCalledTimes(1);
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
