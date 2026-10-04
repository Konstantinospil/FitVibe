import request from "supertest";
import app from "../../../../apps/backend/src/app.js";

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

      const sources = response.body.sources as {
        authorityUnavailable: boolean;
        persistedMaintenance: boolean;
        emergencyOverride: boolean;
        activationSafety: boolean;
      };

      expect(typeof sources.authorityUnavailable).toBe("boolean");
      expect(typeof sources.persistedMaintenance).toBe("boolean");
      expect(typeof sources.emergencyOverride).toBe("boolean");
      expect(typeof sources.activationSafety).toBe("boolean");

      expect(response.body.readOnlyMode).toBe(
        sources.authorityUnavailable ||
          sources.persistedMaintenance ||
          sources.emergencyOverride ||
          sources.activationSafety,
      );
      expect(response.body.message === null || typeof response.body.message === "string").toBe(true);
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
