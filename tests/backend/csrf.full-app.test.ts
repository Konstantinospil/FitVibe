import request from "supertest";
import type { Express } from "express";

const APP_ORIGIN = "http://localhost:5173";
const LOGIN_PATH = "/api/v1/auth/login";

describe("Full FitVibe app CSRF enforcement with production-equivalent settings", () => {
  let app: Express;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CSRF_ENABLED: process.env.CSRF_ENABLED,
    CLAMAV_ENABLED: process.env.CLAMAV_ENABLED,
    COOKIE_SECURE: process.env.COOKIE_SECURE,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    CSRF_ALLOWED_ORIGINS: process.env.CSRF_ALLOWED_ORIGINS,
  };

  beforeAll(() => {
    process.env.NODE_ENV = "production";
    process.env.CSRF_ENABLED = "true";
    process.env.CLAMAV_ENABLED = "true";
    process.env.COOKIE_SECURE = "true";
    process.env.ALLOWED_ORIGINS = APP_ORIGIN;
    process.env.CSRF_ALLOWED_ORIGINS = APP_ORIGIN;

    jest.resetModules();

    // Only the database-backed policy value is replaced; the actual Express
    // application, middleware chain, CSRF verification and auth route are used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require("../../apps/backend/src/modules/system/app-settings.runtime.js") as {
      getRuntimeAppSetting: (key: string) => number;
    };
    jest.spyOn(runtime, "getRuntimeAppSetting").mockImplementation((key: string) =>
      key.endsWith("_duration_seconds") ? 60 : 1000,
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require("../../apps/backend/src/app.js").default as Express;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("issues an HttpOnly, Secure, SameSite CSRF cookie through the full API router", async () => {
    const response = await request(app).get("/api/v1/csrf-token");
    expect(response.status).toBe(200);
    expect(typeof response.body.csrfToken).toBe("string");
    const cookie = (response.headers["set-cookie"] as string[] | undefined)?.find((value) =>
      value.startsWith("__Host-fitvibe-csrf="),
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("rejects cookie-authenticated login requests without CSRF tokens", async () => {
    const response = await request(app)
      .post(LOGIN_PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", "fitvibe_access=sample-cookie")
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("rejects invalid tokens even when the browser sends a CSRF cookie", async () => {
    const csrf = await request(app).get("/api/v1/csrf-token");
    const cookie = (csrf.headers["set-cookie"] as string[])[0].split(";")[0];
    const response = await request(app)
      .post(LOGIN_PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", `${cookie}; fitvibe_access=sample-cookie`)
      .set("X-CSRF-Token", "invalid-token")
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("accepts a matched CSRF secret and token before reaching login validation", async () => {
    const csrf = await request(app).get("/api/v1/csrf-token");
    expect(csrf.status).toBe(200);
    const cookie = (csrf.headers["set-cookie"] as string[])[0].split(";")[0];
    const response = await request(app)
      .post(LOGIN_PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", `${cookie}; fitvibe_access=sample-cookie`)
      .set("X-CSRF-Token", csrf.body.csrfToken as string)
      .send({});
    // Validation, not CSRF, must reject an empty login body.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a cookie-authenticated mutation without Origin or Referer", async () => {
    const csrf = await request(app).get("/api/v1/csrf-token");
    const cookie = (csrf.headers["set-cookie"] as string[])[0].split(";")[0];
    const response = await request(app)
      .post(LOGIN_PATH)
      .set("Cookie", `${cookie}; fitvibe_access=sample-cookie`)
      .set("X-CSRF-Token", csrf.body.csrfToken as string)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("permits cookie-free native bearer requests to reach the existing auth route", async () => {
    const response = await request(app)
      .post(LOGIN_PATH)
      .set("Authorization", "Bearer native-test-token")
      .send({});
    // A bearer-only native request intentionally bypasses CSRF but not DTO validation.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies CSRF checks to PATCH and DELETE before route lookup", async () => {
    for (const method of ["patch", "delete"] as const) {
      const response = await request(app)
        [method]("/api/v1/csrf-full-app-nonexistent")
        .set("Origin", APP_ORIGIN)
        .set("Cookie", "fitvibe_access=sample-cookie")
        .send({});
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
    }
  });
});
