import request from "supertest";
import app from "../../../../apps/backend/src/app.js";
import { env } from "../../../../apps/backend/src/config/env.js";

describe("System Routes", () => {
  describe("GET /api/v1/system/health", () => {
    it("returns health status", async () => {
      const response = await request(app).get("/api/v1/system/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("version");
      expect(response.body).toHaveProperty("timestamp");
      expect(typeof response.body.uptime).toBe("number");
      expect(typeof response.body.version).toBe("string");
    });
  });

  describe("GET /api/v1/system/read-only/status", () => {
    it("returns effective read-only state and its sources", async () => {
      const response = await request(app).get("/api/v1/system/read-only/status");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("readOnlyMode");
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("sources");
      expect(response.body).toHaveProperty("activeRevision");
      expect(response.body).toHaveProperty("loadedRevision");
      expect(response.body).toHaveProperty("timestamp");
      expect(typeof response.body.readOnlyMode).toBe("boolean");
    });

    it("reports the emergency deployment override as a read-only source", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = true;

      try {
        const response = await request(app).get("/api/v1/system/read-only/status");

        expect(response.status).toBe(200);
        expect(response.body.readOnlyMode).toBe(true);
        expect(response.body.sources).toMatchObject({
          emergencyOverride: true,
        });
        expect(typeof response.body.message).toBe("string");
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });
  });

  describe("legacy read-only mutation endpoints", () => {
    it("does not expose the former normal-admin enable endpoint", async () => {
      const response = await request(app)
        .post("/api/v1/system/read-only/enable")
        .send({ reason: "Test" });

      expect(response.status).toBe(404);
    });

    it("does not expose the former normal-admin disable endpoint", async () => {
      const response = await request(app)
        .post("/api/v1/system/read-only/disable")
        .send({ notes: "Test" });

      expect(response.status).toBe(404);
    });
  });
});
