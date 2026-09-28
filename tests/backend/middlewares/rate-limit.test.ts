import type { Request, Response, NextFunction } from "express";
import {
  rateLimit,
  rateLimitByUser,
  rateLimitByIPAndEmail,
  rateLimitFromPolicy,
  clearRateLimiters,
} from "../../../apps/backend/src/middlewares/rate-limit.js";
import { getRouteRateLimitPolicy } from "../../../apps/backend/src/middlewares/rate-limit.policy.js";
import { extractClientIpForRateLimit } from "../../../apps/backend/src/utils/ip-extractor.js";

// Mock dependencies
jest.mock("../../../apps/backend/src/utils/ip-extractor.js", () => ({
  extractClientIpForRateLimit: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("rate-limiter-flexible", () => ({
  RateLimiterMemory: jest.fn().mockImplementation(() => ({
    consume: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("Rate Limiter Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    clearRateLimiters();
    jest.clearAllMocks();

    const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
      RateLimiterMemory: jest.Mock;
    };
    RateLimiterMemory.mockImplementation(() => ({
      consume: jest.fn().mockResolvedValue(undefined),
    }));

    mockRequest = {
      user: undefined,
      headers: {},
      ip: "127.0.0.1",
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      locals: { requestId: "request-123" },
    };

    mockNext = jest.fn();
  });

  describe("canonical route policy", () => {
    it("returns the classified policy for a known route", () => {
      expect(getRouteRateLimitPolicy("auth_login")).toEqual({
        points: 10,
        duration: 60,
      });
    });

    it("fails closed for an unclassified route key", () => {
      expect(() => getRouteRateLimitPolicy("unclassified_route")).toThrow(
        "Unclassified route rate-limit policy: unclassified_route",
      );
    });
  });

  describe("rateLimit", () => {
    it("should allow request when under limit", async () => {
      const middleware = rateLimit("test", 10, 60);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("uses canonical policy when no explicit override is supplied", async () => {
      const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
        RateLimiterMemory: jest.Mock;
      };
      const middleware = rateLimit("auth_login");

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(RateLimiterMemory).toHaveBeenCalledWith({
        keyPrefix: "auth_login",
        points: 10,
        duration: 60,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("rejects incomplete explicit overrides", () => {
      const middleware = rateLimit("auth_login", 5);

      expect(() =>
        middleware(mockRequest as Request, mockResponse as Response, mockNext),
      ).toThrow("Rate-limit overrides require both points and duration for auth_login");
    });

    it("returns a stable 429 response with retry metadata when the limit is exceeded", async () => {
      const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
        RateLimiterMemory: jest.Mock;
      };
      RateLimiterMemory.mockImplementationOnce(() => ({
        consume: jest.fn().mockRejectedValue({ msBeforeNext: 2500 }),
      }));
      const middleware = rateLimit("test-reject", 1, 60);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Retry-After", "3");
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
          requestId: "request-123",
          retryAfter: 3,
        },
      });
    });

    it("should use a fresh limiter after clearRateLimiters", async () => {
      const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
        RateLimiterMemory: jest.Mock;
      };
      const middleware = rateLimit("test-reset", 10, 60);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      const callsAfterFirst = RateLimiterMemory.mock.calls.length;

      clearRateLimiters();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(RateLimiterMemory.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  describe("rateLimitByUser", () => {
    it("should use user ID when authenticated", async () => {
      mockRequest.user = { sub: "user-123", role: "athlete" };
      const middleware = rateLimitByUser("test", 10, 60);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should fall back to IP when not authenticated", async () => {
      const middleware = rateLimitByUser("test", 10, 60);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(extractClientIpForRateLimit).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("rateLimitByIPAndEmail", () => {
    it("normalizes email and applies both IP and email identities", async () => {
      const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
        RateLimiterMemory: jest.Mock;
      };
      mockRequest.body = { email: "  User@Example.COM  " };
      const middleware = rateLimitByIPAndEmail("contact_submit", 5, 3600);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const createdLimiters = RateLimiterMemory.mock.results
        .map((result) => result.value as { consume: jest.Mock })
        .filter(Boolean);
      const ipLimiter = createdLimiters.at(-2);
      const emailLimiter = createdLimiters.at(-1);

      expect(ipLimiter?.consume).toHaveBeenCalledWith("127.0.0.1");
      expect(emailLimiter?.consume).toHaveBeenCalledWith("email:user@example.com");
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("rateLimitFromPolicy", () => {
    it("re-evaluates governed runtime policy on every request", async () => {
      const { RateLimiterMemory } = jest.requireMock("rate-limiter-flexible") as {
        RateLimiterMemory: jest.Mock;
      };
      const getPolicy = jest
        .fn()
        .mockReturnValueOnce({ points: 120, duration: 60 })
        .mockReturnValueOnce({ points: 240, duration: 60 });
      const middleware = rateLimitFromPolicy("global", getPolicy);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getPolicy).toHaveBeenCalledTimes(2);
      expect(RateLimiterMemory).toHaveBeenNthCalledWith(1, {
        keyPrefix: "global",
        points: 120,
        duration: 60,
      });
      expect(RateLimiterMemory).toHaveBeenNthCalledWith(2, {
        keyPrefix: "global",
        points: 240,
        duration: 60,
      });
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });
});
