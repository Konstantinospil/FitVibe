/**
 * Integration test for avatar upload functionality
 *
 * Tests the complete avatar upload flow:
 * 1. User registration and login
 * 2. Avatar upload via POST /api/v1/users/avatar
 * 3. File validation (type, size, malware scanning)
 * 4. Image processing (resize, format conversion)
 * 5. Avatar retrieval via GET /api/v1/users/avatar/:id
 * 6. Avatar deletion via DELETE /api/v1/users/avatar
 * 7. Idempotency support
 * 8. Audit logging
 *
 * Uses real database with transaction-based cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import {
  truncateAll,
  ensureRolesSeeded,
  withDatabaseErrorHandling,
  ensureUsernameColumnExists,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { v4 as uuidv4 } from "uuid";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";

describeWithTestDatabase("Integration: Avatar Upload", () => {
  let authToken: string;
  let userId: string;

  // Helper to create a test image buffer
  async function createTestImageBuffer(
    width = 500,
    height = 500,
    format: "png" | "jpeg" | "webp" = "png",
  ): Promise<Buffer> {
    const image = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    });
    return await image[format]({ quality: 90 }).toBuffer();
  }

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;

      await truncateAll();
      await ensureRolesSeeded();

      // Create and login a test user
      const testEmail = `test-${uuidv4()}@example.com`;
      const testUsername = `testuser-${uuidv4().substring(0, 8)}`;
      const hashedPassword = await bcrypt.hash("SecureP@ssw0rd123!", 10);

      const userIdValue = uuidv4();
      const user = await createUser({
        id: userIdValue,
        username: testUsername,
        display_name: "Test User",
        password_hash: hashedPassword,
        primaryEmail: testEmail,
        emailVerified: true,
        role_code: "athlete",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: getCurrentTermsVersion(),
      });

      if (!user) {
        throw new Error("Failed to create user");
      }
      userId = user.id;

      // Login to get auth token
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: testEmail,
        password: "SecureP@ssw0rd123!",
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.tokens).toBeDefined();
      authToken = loginResponse.body.tokens.accessToken;
      expect(authToken).toBeTruthy();
    }, "beforeEach");
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("should upload avatar successfully", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "png");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.fileUrl).toBe(`/api/v1/users/avatar/${userId}`);
    expect(response.body.mimeType).toBe("image/png");
    expect(response.body.bytes).toBeGreaterThan(0);
    expect(response.body.preview).toContain("data:image/png;base64,");
    expect(response.body.updatedAt).toBeTruthy();
  });

  it("should reject upload without file", async () => {
    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("UPLOAD_NO_FILE");
  });

  it("should reject unsupported file type", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", pdfBuffer, "test.pdf")
      .field("Content-Type", "application/pdf");

    expect(response.status).toBe(422);
  });

  it("should reject file that is too large", async () => {
    // Create a large buffer (6 MB > 5 MB limit)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", largeBuffer, "large-file.png")
      .field("Content-Type", "image/png");

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("UPLOAD_TOO_LARGE");
  });

  it("should accept JPEG image", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "jpeg");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.jpg");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.mimeType).toBe("image/png"); // Should be converted to PNG
  });

  it("should accept WebP image", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "webp");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.webp");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.mimeType).toBe("image/png"); // Should be converted to PNG
  });

  it("should reject a non-image payload even when the declared MIME type is allowed", async () => {
    const response = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", Buffer.from("not-an-image"), {
        filename: "spoofed.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("UPLOAD_UNSUPPORTED_TYPE");
  });

  it("should reject EICAR through antivirus scanning and audit the rejection", async () => {
    const eicar = Buffer.from(
      "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    );

    const response = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", eicar, {
        filename: "eicar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(422);
    expect(response.body.error?.code).toBe("E.UPLOAD.MALWARE_DETECTED");

    const audit = await db("audit_log")
      .where({ actor_user_id: userId, action: "avatar_upload_rejected" })
      .orderBy("created_at", "desc")
      .first();

    expect(audit).toBeDefined();
    expect(audit.entity_type).toBe("user_media");
    expect(audit.metadata).toMatchObject({ reason: "malware_detected" });
  });

  it("should process and resize image to 128x128", async () => {
    // Create a large image (1000x1000)
    const imageBuffer = await createTestImageBuffer(1000, 1000, "png");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "large-avatar.png");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    // Verify the processed image is 128x128 by decoding the preview
    const base64Data = response.body.preview.split(",")[1];
    const processedBuffer = Buffer.from(base64Data, "base64");
    const metadata = await sharp(processedBuffer).metadata();

    expect(metadata.width).toBe(128);
    expect(metadata.height).toBe(128);
  });

  it("should retrieve uploaded avatar", async () => {
    // Upload avatar first
    const imageBuffer = await createTestImageBuffer(500, 500, "png");
    const uploadResponse = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(uploadResponse.status).toBe(201);

    // Retrieve avatar
    const getResponse = await request(app).get(`/api/v1/users/avatar/${userId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers["content-type"]).toContain("image/png");
    expect(getResponse.headers["cache-control"]).toBe("private, max-age=300");
    expect(Buffer.isBuffer(getResponse.body)).toBe(true);
    expect(getResponse.body.length).toBeGreaterThan(0);
  });

  it("should return 404 for non-existent avatar", async () => {
    const nonExistentUserId = uuidv4();
    const response = await request(app).get(`/api/v1/users/avatar/${nonExistentUserId}`);

    expect(response.status).toBe(404);
  });

  it("should delete avatar successfully", async () => {
    // Upload avatar first
    const imageBuffer = await createTestImageBuffer(500, 500, "png");
    const uploadResponse = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(uploadResponse.status).toBe(201);

    // Delete avatar
    const deleteResponse = await request(app)
      .delete("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`);

    expect(deleteResponse.status).toBe(204);

    // Verify avatar is deleted
    const getResponse = await request(app).get(`/api/v1/users/avatar/${userId}`);
    expect(getResponse.status).toBe(404);
  });

  it("should handle deleting non-existent avatar gracefully", async () => {
    // Try to delete avatar that doesn't exist
    const deleteResponse = await request(app)
      .delete("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`);

    // Should return 204 even if avatar doesn't exist (idempotent)
    expect(deleteResponse.status).toBe(204);
  });

  it("should replace existing avatar when uploading new one", async () => {
    // Upload first avatar
    const imageBuffer1 = await createTestImageBuffer(500, 500, "png");
    const uploadResponse1 = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer1, "avatar1.png");

    expect(uploadResponse1.status).toBe(201);
    const firstFileUrl = uploadResponse1.body.fileUrl;

    // Upload second avatar (should replace first)
    const imageBuffer2 = await createTestImageBuffer(600, 600, "png");
    const uploadResponse2 = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer2, "avatar2.png");

    expect(uploadResponse2.status).toBe(201);
    expect(uploadResponse2.body.fileUrl).toBe(firstFileUrl); // Same URL

    // Verify only one avatar exists
    const getResponse = await request(app).get(`/api/v1/users/avatar/${userId}`);
    expect(getResponse.status).toBe(200);
  });

  it("should support idempotency for upload", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "png");
    const idempotencyKey = `test-key-${uuidv4()}`;

    // First upload
    const response1 = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(response1.status).toBe(201);
    expect(response1.headers["idempotency-key"]).toBe(idempotencyKey);
    const firstFileUrl = response1.body.fileUrl;
    const firstBytes = response1.body.bytes;

    // Second upload with same idempotency key (should replay)
    const response2 = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(response2.status).toBe(201);
    expect(response2.headers["idempotent-replayed"]).toBe("true");
    expect(response2.headers["idempotency-key"]).toBe(idempotencyKey);
    expect(response2.body.fileUrl).toBe(firstFileUrl);
    expect(response2.body.bytes).toBe(firstBytes);
  });

  it("should support idempotency for delete", async () => {
    // Upload avatar first
    const imageBuffer = await createTestImageBuffer(500, 500, "png");
    await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    const idempotencyKey = `test-key-${uuidv4()}`;

    // First delete
    const response1 = await request(app)
      .delete("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .set("Idempotency-Key", idempotencyKey);

    expect(response1.status).toBe(204);
    expect(response1.headers["idempotency-key"]).toBe(idempotencyKey);

    // Second delete with same idempotency key (should replay)
    const response2 = await request(app)
      .delete("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .set("Idempotency-Key", idempotencyKey);

    expect(response2.status).toBe(204);
    expect(response2.headers["idempotent-replayed"]).toBe("true");
    expect(response2.headers["idempotency-key"]).toBe(idempotencyKey);
  });

  it("should verify audit log entry is created for upload", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "png");

    await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    // Check audit log
    const auditLogs = await db("audit_log")
      .where({ actor_user_id: userId, action: "avatar_upload" })
      .orderBy("created_at", "desc")
      .limit(1);

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].entity_type).toBe("user_media");
    expect(auditLogs[0].metadata).toHaveProperty("size");
    expect(auditLogs[0].metadata).toHaveProperty("mime");
  });

  it("should verify audit log entry is created for delete", async () => {
    // Upload avatar first
    const imageBuffer = await createTestImageBuffer(500, 500, "png");
    await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");

    // Delete avatar
    await request(app).delete("/api/v1/users/avatar").set("Authorization", `Bearer ${authToken}`);

    // Check audit log
    const auditLogs = await db("audit_log")
      .where({ actor_user_id: userId, action: "avatar_delete" })
      .orderBy("created_at", "desc")
      .limit(1);

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].entity_type).toBe("user_media");
  });

  it("should require authentication for upload", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "png");

    const response = await request(app)
      .post("/api/v1/users/avatar")
      .attach("avatar", imageBuffer, "test-avatar.png");

    expect(response.status).toBe(401);
  });

  it("should require authentication for delete", async () => {
    const response = await request(app).delete("/api/v1/users/avatar");

    expect(response.status).toBe(401);
  });

  it("should respond within reasonable time", async () => {
    const imageBuffer = await createTestImageBuffer(500, 500, "png");

    const startTime = Date.now();
    const response = await request(app)
      .post("/api/v1/users/avatar")
      .set("Authorization", `Bearer ${authToken}`)
      .attach("avatar", imageBuffer, "test-avatar.png");
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(201);
    // Avatar processing (resize, format conversion) might take longer
    expect(responseTime).toBeLessThan(2000); // 2 seconds
  });
});
