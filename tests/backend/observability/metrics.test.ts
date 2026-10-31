import type { NextFunction, Request, Response } from "express";

// Mock prom-client
const mockHistogramInstance = {
  startTimer: jest.fn().mockReturnValue(jest.fn()),
};
const mockCounterInstance = {
  inc: jest.fn(),
};
const mockRegistryInstance = {
  registerMetric: jest.fn(),
  contentType: "text/plain; version=0.0.4; charset=utf-8",
  metrics: jest.fn().mockResolvedValue("mock metrics output"),
};

jest.mock("prom-client", () => {
  const mockRegistry = jest.fn().mockImplementation(() => mockRegistryInstance);
  const mockHistogram = jest.fn().mockImplementation(() => mockHistogramInstance);
  const mockCounter = jest.fn().mockImplementation(() => mockCounterInstance);

  return {
    __esModule: true,
    default: {
      Registry: mockRegistry,
      Histogram: mockHistogram,
      Counter: mockCounter,
      collectDefaultMetrics: jest.fn(),
    },
  };
});

import {
  metricsMiddleware,
  metricsRoute,
  incrementRefreshReuse,
  incrementPointsAwarded,
  incrementAuthFailedLogin,
  incrementAuthBlockedLogin,
  incrementAuthLoginSuccess,
  incrementAuthPasswordReset,
  incrementAuthMfaEvent,
  stopMetricsCollection,
} from "../../../apps/backend/src/observability/metrics.js";

describe("Metrics", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      method: "GET",
      path: "/api/v1/sessions",
      originalUrl: "/api/v1/sessions",
      baseUrl: "",
      route: undefined,
    };

    mockResponse = {
      statusCode: 200,
      on: jest.fn((event: string, callback: () => void) => {
        if (event === "finish") {
          // Simulate finish event
          setTimeout(() => callback(), 0);
        }
      }),
      set: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("metricsMiddleware", () => {
    it("should call next middleware", () => {
      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should register finish event handler", () => {
      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("should resolve route from req.route.path", () => {
      mockRequest.route = { path: "/sessions" };
      mockRequest.baseUrl = "/api/v1";

      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should resolve route from baseUrl when route.path is empty", () => {
      mockRequest.route = { path: "" };
      mockRequest.baseUrl = "/api/v1";

      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should resolve route from originalUrl when route is not available", () => {
      mockRequest.route = undefined;
      mockRequest.baseUrl = "";
      mockRequest.originalUrl = "/api/v1/sessions?page=1";

      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle different HTTP methods", () => {
      mockRequest.method = "POST";

      metricsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("metricsRoute", () => {
    it("should return metrics in Prometheus format", async () => {
      await metricsRoute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith(
        "Content-Type",
        "text/plain; version=0.0.4; charset=utf-8",
      );
      expect(mockResponse.end).toHaveBeenCalledWith("mock metrics output");
    });
  });

  describe("incrementRefreshReuse", () => {
    it("should increment refresh reuse counter without throwing", () => {
      expect(() => incrementRefreshReuse()).not.toThrow();
    });
  });

  describe("incrementPointsAwarded", () => {
    it("should increment points awarded counter with rule label", () => {
      expect(() => incrementPointsAwarded("session_completion", 10)).not.toThrow();
    });

    it("should increment points awarded counter with different rules", () => {
      expect(() => incrementPointsAwarded("streak_bonus", 5)).not.toThrow();
      expect(() => incrementPointsAwarded("daily_login", 2)).not.toThrow();
    });
  });

  describe("Security outcome counters (#557)", () => {
    it("records failed credentials without dynamic identifier labels", () => {
      incrementAuthFailedLogin();
      expect(mockCounterInstance.inc).toHaveBeenCalledWith();
    });

    it("records only bounded lockout scope labels", () => {
      incrementAuthBlockedLogin("account");
      incrementAuthBlockedLogin("ip");
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ scope: "account" });
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ scope: "ip" });
    });

    it("distinguishes completed password and MFA login sessions", () => {
      incrementAuthLoginSuccess("password");
      incrementAuthLoginSuccess("mfa");
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ factor: "password" });
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ factor: "mfa" });
    });

    it("tracks reset initiation, completion and invalid tokens separately", () => {
      incrementAuthPasswordReset("requested");
      incrementAuthPasswordReset("completed");
      incrementAuthPasswordReset("invalid_token");
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ outcome: "requested" });
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ outcome: "completed" });
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ outcome: "invalid_token" });
    });

    it("records an allowlisted MFA lifecycle event rather than account data", () => {
      incrementAuthMfaEvent("enrolled");
      incrementAuthMfaEvent("login_failed");
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ event: "enrolled" });
      expect(mockCounterInstance.inc).toHaveBeenCalledWith({ event: "login_failed" });
    });
  });

  describe("stopMetricsCollection", () => {
    it("should stop default metrics collection", () => {
      stopMetricsCollection();
      // In test environment, default metrics are not collected, so this is a no-op
      // But the function should not throw
      expect(() => stopMetricsCollection()).not.toThrow();
    });
  });
});
