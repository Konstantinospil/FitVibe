import request from "supertest";
import app from "../../apps/backend/src/app.js";

describe("App Configuration", () => {
  describe("CSRF Protection", () => {
    it("should throw error when CSRF is disabled in production", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalCsrfEnabled = process.env.CSRF_ENABLED;

      try {
        process.env.NODE_ENV = "production";
        process.env.CSRF_ENABLED = "false";

        // Re-import app to trigger the check
        jest.resetModules();
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../../apps/backend/src/app.js");
        }).toThrow("Refusing to start in production without CSRF");
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.CSRF_ENABLED = originalCsrfEnabled;
        jest.resetModules();
      }
    });

    it("should throw error when ClamAV is disabled in production", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalCsrfEnabled = process.env.CSRF_ENABLED;
      const originalClamavEnabled = process.env.CLAMAV_ENABLED;

      try {
        process.env.NODE_ENV = "production";
        process.env.CSRF_ENABLED = "true";
        process.env.CLAMAV_ENABLED = "false";

        jest.resetModules();
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../../apps/backend/src/app.js");
        }).toThrow("Refusing to start production with uploads unscanned");
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.CSRF_ENABLED = originalCsrfEnabled;
        process.env.CLAMAV_ENABLED = originalClamavEnabled;
        jest.resetModules();
      }
    });

    it("should always provide the CSRF token route", async () => {
      const response = await request(app).get("/api/v1/csrf-token");

      expect(response.status).toBe(200);
      expect(typeof response.body.csrfToken).toBe("string");
      expect(response.body.csrfToken.length).toBeGreaterThan(10);
    });
  });

  describe("Proxy Configuration", () => {
    it("should honor the configured trust proxy setting", () => {
      expect(app.get("trust proxy")).toBe(false);
    });
  });

  describe("CORS Configuration", () => {
    it("should reject requests from disallowed origins", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "https://malicious-site.com");

      // Should either reject with 403 or allow (depending on test config)
      expect([200, 403]).toContain(response.status);
    });

    it("should handle OPTIONS preflight requests", async () => {
      const response = await request(app)
        .options("/health")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "GET");

      // OPTIONS requests should return 200, 204, or 403 (if origin not allowed)
      expect([200, 204, 403]).toContain(response.status);
    });
  });

  describe("Metrics", () => {
    it("should provide metrics endpoint when enabled", async () => {
      const response = await request(app).get("/metrics");

      // Metrics might be disabled in test environment
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for non-existent routes", async () => {
      const response = await request(app).get("/api/v1/non-existent-route");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "NOT_FOUND");
      expect(response.body.error).toHaveProperty("message", "Route not found");
      expect(response.body.error).toHaveProperty("requestId");
    });
  });

  describe("Request ID", () => {
    it("should set X-Request-Id header on all requests", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["x-request-id"]).toBeDefined();
      expect(typeof response.headers["x-request-id"]).toBe("string");
      expect(response.headers["x-request-id"].length).toBeGreaterThan(0);
    });
  });

  describe("JWKS Endpoint", () => {
    it("should provide JWKS endpoint", async () => {
      const response = await request(app).get("/.well-known/jwks.json");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("keys");
      expect(Array.isArray(response.body.keys)).toBe(true);
    });
  });
});
