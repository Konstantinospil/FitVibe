import request from "supertest";
import type { Express } from "express";

const APP_ORIGIN = "http://localhost:5173";
const PATH = "/api/v1/client-errors";

describe("POST /api/v1/client-errors through the full app (ADR-040)", () => {
  let app: Express;
  let warn: jest.SpyInstance;
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

    type Runtime = {
      getRuntimeAppSetting: (key: string) => number;
      isEffectiveReadOnly: () => boolean;
    };
    const runtimePath = "../../../../apps/backend/src/modules/system/app-settings.runtime.js";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require(runtimePath) as Runtime;
    jest
      .spyOn(runtime, "getRuntimeAppSetting")
      .mockImplementation((key: string) => (key.endsWith("_duration_seconds") ? 60 : 1000));
    jest.spyOn(runtime, "isEffectiveReadOnly").mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require("../../../../apps/backend/src/config/logger.js") as {
      logger: { warn: (...args: unknown[]) => void };
    };
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require("../../../../apps/backend/src/app.js").default as Express;
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

  async function csrf(): Promise<{ cookie: string; token: string }> {
    const response = await request(app).get("/api/v1/csrf-token");
    return {
      cookie: (response.headers["set-cookie"] as string[])[0].split(";")[0],
      token: response.body.csrfToken as string,
    };
  }

  it("accepts an anonymous report with a CSRF token and logs it sanitized", async () => {
    const { cookie, token } = await csrf();
    const response = await request(app)
      .post(PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", token)
      .send({
        kind: "error",
        message: "Pattern invalid (http://localhost:5173/register/complete?token=secret-token)",
        route: "/register/complete",
      });

    expect(response.status).toBe(204);
    const logged = warn.mock.calls.find(
      ([, message]) => message === "[client-error] Browser reported an error",
    );
    expect(logged?.[0]).toMatchObject({
      clientError: {
        kind: "error",
        message: "Pattern invalid (http://localhost:5173/register/complete)",
        route: "/register/complete",
      },
    });
    expect(JSON.stringify(logged)).not.toContain("secret-token");
  });

  it("rejects reports without a CSRF token", async () => {
    const response = await request(app)
      .post(PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", "fitvibe_access=sample-cookie")
      .send({ kind: "error", message: "boom", route: "/" });
    expect(response.status).toBe(403);
  });

  it("rejects reports that carry extra fields", async () => {
    const { cookie, token } = await csrf();
    const response = await request(app)
      .post(PATH)
      .set("Origin", APP_ORIGIN)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", token)
      .send({ kind: "error", message: "boom", route: "/", email: "a@b.co" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
