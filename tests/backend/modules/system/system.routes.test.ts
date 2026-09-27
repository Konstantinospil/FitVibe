import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import app from "../../../../apps/backend/src/app.js";
import { env } from "../../../../apps/backend/src/config/env.js";
import {
  createAuthSession,
  createUser,
  type AuthUserRecord,
} from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import { signAccess } from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import { truncateAll, ensureRolesSeeded } from "../../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../../setup/db-availability.js";
import { getCurrentTermsVersion } from "../../../../apps/backend/src/config/terms.js";

async function seedUser(params: {
  email: string;
  username: string;
  displayName: string;
  roleCode: string;
}): Promise<AuthUserRecord> {
  const now = new Date().toISOString();
  const user = await createUser({
    id: uuidv4(),
    username: params.username,
    display_name: params.displayName,
    status: "active",
    role_code: params.roleCode,
    password_hash: "hashed",
    primaryEmail: params.email,
    emailVerified: true,
    terms_accepted: true,
    terms_accepted_at: now,
    terms_version: getCurrentTermsVersion(),
  });
  if (!user) {
    throw new Error(`Failed to create user ${params.email}`);
  }
  return user;
}

async function tokenFor(user: AuthUserRecord): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();
  await createAuthSession({
    jti: sessionId,
    user_id: user.id,
    user_agent: "system-routes-test",
    ip: null,
    created_at: now,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return signAccess({
    sub: user.id,
    role: user.role_code,
    sid: sessionId,
  });
}

describeWithTestDatabase("System Routes", () => {
  let adminUser: AuthUserRecord;
  let adminToken: string;

  beforeAll(async () => {
    await ensureRolesSeeded();
  });

  beforeEach(async () => {
    try {
      await truncateAll();
      await ensureRolesSeeded();

      adminUser = await seedUser({
        email: "admin@test.com",
        username: "admin",
        displayName: "Admin",
        roleCode: "admin",
      });
      adminToken = await tokenFor(adminUser);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("does not exist")) {
        throw new Error(`System routes tests require migrated tables: ${errorMessage}`);
      }
      throw error;
    }
  });

  describe("GET /api/v1/system/health", () => {
    it("should return health status", async () => {
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
    it("should return read-only mode status", async () => {
      const response = await request(app).get("/api/v1/system/read-only/status");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("readOnlyMode");
      expect(response.body).toHaveProperty("timestamp");
      expect(typeof response.body.readOnlyMode).toBe("boolean");
    });

    it("should include maintenance message when in read-only mode", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = true;

      try {
        const response = await request(app).get("/api/v1/system/read-only/status");

        expect(response.status).toBe(200);
        expect(response.body.readOnlyMode).toBe(true);
        expect(response.body).toHaveProperty("message");
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });
  });

  describe("POST /api/v1/system/read-only/enable", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/system/read-only/enable")
        .send({ reason: "Test" });

      expect(response.status).toBe(401);
    });

    it("should require admin role", async () => {
      const regularUser = await seedUser({
        email: "user@test.com",
        username: "user",
        displayName: "Athlete",
        roleCode: "athlete",
      });

      const regularToken = await tokenFor(regularUser);
      const response = await request(app)
        .post("/api/v1/system/read-only/enable")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ reason: "Test" });

      expect(response.status).toBe(403);
    });

    it("should enable read-only mode", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      try {
        const response = await request(app)
          .post("/api/v1/system/read-only/enable")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            reason: "Emergency maintenance",
            estimatedDuration: "30 minutes",
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("readOnlyMode", true);
        expect(response.body).toHaveProperty("message");
        expect(env.readOnlyMode).toBe(true);
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });

    it("should handle missing optional fields", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      try {
        const response = await request(app)
          .post("/api/v1/system/read-only/enable")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.readOnlyMode).toBe(true);
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });
  });

  describe("POST /api/v1/system/read-only/disable", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/system/read-only/disable")
        .send({ notes: "Test" });

      expect(response.status).toBe(401);
    });

    it("should require admin role", async () => {
      const regularUser = await seedUser({
        email: "user2@test.com",
        username: "user2",
        displayName: "Athlete Two",
        roleCode: "athlete",
      });

      const regularToken = await tokenFor(regularUser);
      const response = await request(app)
        .post("/api/v1/system/read-only/disable")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ notes: "Test" });

      expect(response.status).toBe(403);
    });

    it("should disable read-only mode", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = true;

      try {
        const response = await request(app)
          .post("/api/v1/system/read-only/disable")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            notes: "Maintenance completed",
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("readOnlyMode", false);
        expect(response.body).toHaveProperty("message");
        expect(env.readOnlyMode).toBe(false);
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });

    it("should handle missing optional fields", async () => {
      const originalReadOnly = env.readOnlyMode;
      (env as { readOnlyMode: boolean }).readOnlyMode = true;

      try {
        const response = await request(app)
          .post("/api/v1/system/read-only/disable")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.readOnlyMode).toBe(false);
      } finally {
        (env as { readOnlyMode: boolean }).readOnlyMode = originalReadOnly;
      }
    });
  });
});
