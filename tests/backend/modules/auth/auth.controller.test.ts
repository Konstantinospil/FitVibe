import type { NextFunction, Request, Response } from "express";
import * as authController from "../../../../apps/backend/src/modules/auth/auth.controller.js";
import * as authService from "../../../../apps/backend/src/modules/auth/auth.service.js";
import * as registrationOptionsService from "../../../../apps/backend/src/modules/auth/auth.registration-options.service.js";
import * as idempotencyService from "../../../../apps/backend/src/modules/common/idempotency.service.js";
import * as tokensService from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.registration-options.service.js");
jest.mock("../../../../apps/backend/src/modules/common/idempotency.service.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../../apps/backend/src/services/mailer.service.js", () => ({
  mailerService: {
    send: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: {
    email: { enabled: false },
    REFRESH_COOKIE_NAME: "refresh_token",
    ACCESS_COOKIE_NAME: "access_token",
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: "localhost",
    REFRESH_TOKEN_TTL: 604800,
    ACCESS_TOKEN_TTL: 3600,
    isProduction: false,
    frontendUrl: "http://localhost:3000",
    appBaseUrl: "http://localhost:3000",
    database: {
      host: "localhost",
      port: 5432,
      name: "fitvibe",
      user: "fitvibe",
      password: "fitvibe",
    },
  },
  JWKS: { keys: [] },
}));

const mockAuthService = jest.mocked(authService);
const mockRegistrationOptionsService = jest.mocked(registrationOptionsService);
const mockIdempotencyService = jest.mocked(idempotencyService);
const mockTokensService = jest.mocked(tokensService);

describe("Auth Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { sub: userId, sid: sessionId, role: "athlete" },
      body: {},
      query: {},
      params: {},
      headers: {},
      cookies: {},
      get: jest.fn(),
      method: "POST",
      baseUrl: "/api/v1",
      route: { path: "/auth/register" },
      originalUrl: "/api/v1/auth/register",
      ip: "127.0.0.1",
      requestId: "req-123",
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      locals: {},
    };

    mockNext = jest.fn();
  });

  describe("registrationOptions", () => {
    it("returns the current database-backed registration options", async () => {
      mockRegistrationOptionsService.getRegistrationOptions.mockResolvedValue({
        genders: [{ code: "gender-a", description: "Gender A" }],
        fitnessLevels: [{ code: "level-a", description: "Level A" }],
        weight: { minKg: 20, maxKg: 400 },
      });

      await authController.registrationOptions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRegistrationOptionsService.getRegistrationOptions).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        genders: [{ code: "gender-a", description: "Gender A" }],
        fitnessLevels: [{ code: "level-a", description: "Level A" }],
        weight: { minKg: 20, maxKg: 400 },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("forwards registration-options failures to Express error handling", async () => {
      const error = new Error("catalog unavailable");
      mockRegistrationOptionsService.getRegistrationOptions.mockRejectedValue(error);

      await authController.registrationOptions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("should register a new user successfully without idempotency", async () => {
      const registerData = {
        email: "test@example.com",
        username: "testuser",
        password: "SecureP@ssw0rd123",
        terms_accepted: true,
      };

      mockRequest.body = registerData;
      (mockRequest.get as jest.Mock).mockReturnValue(undefined); // No idempotency key
      mockAuthService.register.mockResolvedValue({
        verificationToken: "verification-token",
        user: {
          id: userId,
          email: registerData.email,
          username: registerData.username,
          role: "athlete",
          status: "pending_verification",
          created_at: new Date().toISOString(),
        },
      });

      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "If the email is valid, a verification link will be sent shortly.",
          debugVerificationToken: "verification-token",
          verificationUrl: expect.stringContaining("/verify?token=verification-token"),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle idempotency replay", async () => {
      const registerData = {
        email: "test@example.com",
        username: "testuser",
        password: "SecureP@ssw0rd123",
        terms_accepted: true,
      };

      mockRequest.body = registerData;
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 202,
        body: { message: "Already processed" },
      });

      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key");
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockAuthService.register).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle idempotency new request", async () => {
      const registerData = {
        email: "test@example.com",
        username: "testuser",
        password: "SecureP@ssw0rd123",
        terms_accepted: true,
      };

      mockRequest.body = registerData;
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockAuthService.register.mockResolvedValue({
        verificationToken: "verification-token",
        user: {
          id: userId,
          email: registerData.email,
          username: registerData.username,
          role: "athlete",
          status: "pending_verification",
          created_at: new Date().toISOString(),
        },
      });
      mockIdempotencyService.persistIdempotencyResult.mockResolvedValue(undefined);

      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.register).toHaveBeenCalled();
      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const registerData = {
        email: "test@example.com",
        username: "testuser",
        password: "SecureP@ssw0rd123",
        terms_accepted: true,
      };

      mockRequest.body = registerData;
      const error = new HttpError(400, "VALIDATION_ERROR", "Invalid email");
      mockAuthService.register.mockRejectedValue(error);

      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email with token from query", async () => {
      const token = "verification-token";
      mockRequest.query = { token };
      mockAuthService.verifyEmail.mockResolvedValue({
        id: userId,
        email: "test@example.com",
        username: "testuser",
        role: "athlete",
        status: "active",
        created_at: new Date().toISOString(),
      });

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(token);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: userId }),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should verify email with token from body", async () => {
      const token = "verification-token";
      mockRequest.body = { token };
      mockAuthService.verifyEmail.mockResolvedValue({
        id: userId,
        email: "test@example.com",
        username: "testuser",
        role: "athlete",
        status: "active",
        created_at: new Date().toISOString(),
      });

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(token);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when token is missing", async () => {
      mockRequest.query = {};
      mockRequest.body = {};

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "AUTH_INVALID_TOKEN",
        }),
      );
    });
  });

  describe("resendVerificationEmail", () => {
    it("should resend verification email successfully", async () => {
      const email = "test@example.com";
      mockRequest.body = { email };
      mockAuthService.resendVerificationEmail.mockResolvedValue(undefined);

      await authController.resendVerificationEmail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith(email);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("verification link will be sent"),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should login successfully without 2FA", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecureP@ssw0rd123",
      };

      mockRequest.body = loginData;
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");
      mockAuthService.login.mockResolvedValue({
        requires2FA: false,
        user: {
          id: userId,
          email: loginData.email,
          username: "testuser",
          role: "athlete",
          status: "active",
          created_at: new Date().toISOString(),
        },
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accessExpiresIn: 3600,
        },
        session: {
          id: sessionId,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.login).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "access_token",
        "access-token",
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "refresh-token",
        expect.any(Object),
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requires2FA: false,
          tokens: expect.objectContaining({
            accessToken: "access-token",
          }),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle 2FA requirement", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecureP@ssw0rd123",
      };

      mockRequest.body = loginData;
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");
      mockAuthService.login.mockResolvedValue({
        requires2FA: true,
        pendingSessionId: "pending-session-id",
      });

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        requires2FA: true,
        pendingSessionId: "pending-session-id",
      });
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("verify2FALogin", () => {
    it("should verify 2FA login successfully", async () => {
      const payload = {
        pendingSessionId: "123e4567-e89b-12d3-a456-426614174000",
        code: "123456",
      };

      mockRequest.body = payload;
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");
      mockAuthService.verify2FALogin.mockResolvedValue({
        user: {
          id: userId,
          email: "test@example.com",
          username: "testuser",
          role: "athlete",
          status: "active",
          created_at: new Date().toISOString(),
        },
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accessExpiresIn: 3600,
        },
        session: {
          id: sessionId,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });

      await authController.verify2FALogin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.verify2FALogin).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123456",
        expect.objectContaining({
          userAgent: expect.any(String),
          ip: expect.any(String),
        }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.any(Object),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("should refresh tokens successfully", async () => {
      const refreshToken = "refresh-token";
      mockRequest.cookies = { refresh_token: refreshToken };
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");
      mockAuthService.refresh.mockResolvedValue({
        user: {
          id: userId,
          email: "test@example.com",
          username: "testuser",
          role: "athlete",
          status: "active",
          created_at: new Date().toISOString(),
        },
        newRefresh: "new-refresh-token",
        accessToken: "new-access-token",
      });

      await authController.refresh(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.refresh).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "new-refresh-token",
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "access_token",
        "new-access-token",
        expect.any(Object),
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Object),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when refresh token is missing", async () => {
      mockRequest.cookies = {};

      await authController.refresh(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      );
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      const refreshToken = "refresh-token";
      mockRequest.cookies = { refresh_token: refreshToken };
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");
      mockAuthService.logout.mockResolvedValue(undefined);

      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("should request password reset without idempotency", async () => {
      const email = "test@example.com";
      mockRequest.body = { email };
      mockAuthService.requestPasswordReset.mockResolvedValue({
        resetToken: "reset-token",
      });

      await authController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(email);
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("reset link will be sent"),
          debugResetToken: "reset-token",
          resetUrl: "http://localhost:3000/reset-password?token=reset-token",
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle idempotency replay for password reset", async () => {
      const email = "test@example.com";
      mockRequest.body = { email };
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 202,
        body: { message: "Already processed" },
      });

      await authController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockAuthService.requestPasswordReset).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      const payload = {
        token: "reset-token",
        newPassword: "NewSecureP@ssw0rd123",
      };

      mockRequest.body = payload;
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      await authController.resetPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        payload.token,
        payload.newPassword,
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("listSessions", () => {
    it("should list sessions successfully", async () => {
      const mockSessions = [
        {
          id: sessionId,
          userAgent: "Mozilla/5.0",
          ip: "127.0.0.1",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          revokedAt: null,
          isCurrent: true,
        },
      ];

      mockAuthService.listSessions.mockResolvedValue(mockSessions);
      mockTokensService.verifyAccess.mockReturnValue({ sid: sessionId } as never);

      await authController.listSessions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.listSessions).toHaveBeenCalledWith(userId, sessionId);
      expect(mockResponse.json).toHaveBeenCalledWith({ sessions: mockSessions });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;

      await authController.listSessions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      );
    });
  });

  describe("revokeSessions", () => {
    it("should revoke all sessions", async () => {
      mockRequest.body = { revokeAll: true };
      mockAuthService.revokeSessions.mockResolvedValue({ revoked: 5 });

      await authController.revokeSessions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.revokeSessions).toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should revoke specific session", async () => {
      const targetSessionId = "123e4567-e89b-12d3-a456-426614174001";
      mockRequest.body = { sessionId: targetSessionId };
      mockRequest.cookies = { access_token: "access-token" };
      mockTokensService.verifyAccess.mockReturnValue({ sid: sessionId } as never);
      mockAuthService.revokeSessions.mockResolvedValue({ revoked: 1 });

      await authController.revokeSessions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.revokeSessions).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          sessionId: "123e4567-e89b-12d3-a456-426614174001",
          currentSessionId: sessionId,
        }),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ revoked: 1 });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should revoke other sessions", async () => {
      mockRequest.body = { revokeOthers: true };
      mockAuthService.revokeSessions.mockResolvedValue({ revoked: 3 });

      await authController.revokeSessions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockAuthService.revokeSessions).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ revoked: 3 });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when revoking others without current session", async () => {
      mockRequest.body = { revokeOthers: true };
      mockRequest.user = { sub: userId };
      mockRequest.cookies = {};
      mockRequest.headers = {};

      await authController.revokeSessions(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "AUTH_SESSION_UNKNOWN",
        }),
      );
    });
  });

  describe("acceptTerms", () => {
    it("should accept terms successfully", async () => {
      mockRequest.body = { terms_accepted: true };
      mockAuthService.acceptTerms.mockResolvedValue(undefined);

      await authController.acceptTerms(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.acceptTerms).toHaveBeenCalledWith(userId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Terms accepted successfully",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;

      await authController.acceptTerms(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      );
    });
  });

  describe("jwksHandler", () => {
    it("should return JWKS", () => {
      authController.jwksHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ keys: [] });
    });
  });
});
