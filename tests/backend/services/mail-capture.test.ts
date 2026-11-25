/**
 * Non-production test mailbox for email-first registration (ADR-039).
 */
import { generateKeyPairSync } from "node:crypto";
import express from "express";
import request from "supertest";

describe("mail capture (test mailbox)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("refuses to start production with capture enabled", async () => {
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.NODE_ENV = "production";
    process.env.JWT_PRIVATE_KEY = keys.privateKey;
    process.env.JWT_PUBLIC_KEY = keys.publicKey;
    process.env.EMAIL_CAPTURE_ENABLED = "true";

    await expect(import("../../../apps/backend/src/config/env.js")).rejects.toThrow(
      "EMAIL_CAPTURE_ENABLED must not be set when NODE_ENV=production",
    );
  });

  it("captures nothing when disabled", async () => {
    process.env.EMAIL_CAPTURE_ENABLED = "false";
    const capture = await import("../../../apps/backend/src/services/mail-capture.service.js");

    capture.captureMail({ to: "a@example.com", subject: "s", text: "t" });

    expect(capture.isMailCaptureEnabled()).toBe(false);
    expect(capture.listCapturedMail()).toEqual([]);
  });

  it("records mail sent through the mailer even with SMTP disabled, newest first", async () => {
    process.env.EMAIL_CAPTURE_ENABLED = "true";
    process.env.EMAIL_ENABLED = "false";
    const capture = await import("../../../apps/backend/src/services/mail-capture.service.js");
    const { mailerService } = await import("../../../apps/backend/src/services/mailer.service.js");

    await mailerService.send({ to: "First@Example.com", subject: "one", text: "1" });
    await mailerService.send({ to: "other@example.com", subject: "two", text: "2" });
    await mailerService.send({ to: "first@example.com", subject: "three", text: "3" });

    expect(capture.listCapturedMail("FIRST@example.com").map((m) => m.subject)).toEqual([
      "three",
      "one",
    ]);
    expect(capture.listCapturedMail()).toHaveLength(3);
    capture.clearCapturedMail();
    expect(capture.listCapturedMail()).toEqual([]);
  });

  it("serves and clears captured mail through the dev route", async () => {
    process.env.EMAIL_CAPTURE_ENABLED = "true";
    const capture = await import("../../../apps/backend/src/services/mail-capture.service.js");
    const { mailCaptureRouter } =
      await import("../../../apps/backend/src/modules/dev/mail-capture.routes.js");
    const app = express();
    app.use("/dev", mailCaptureRouter);

    capture.captureMail({ to: "reader@example.com", subject: "hello", text: "link" });

    const listed = await request(app).get("/dev/mail").query({ to: "reader@example.com" });
    expect(listed.status).toBe(200);
    expect(listed.body.messages).toEqual([
      expect.objectContaining({ to: "reader@example.com", subject: "hello", text: "link" }),
    ]);

    expect((await request(app).delete("/dev/mail")).status).toBe(204);
    expect((await request(app).get("/dev/mail")).body.messages).toEqual([]);
  });
});
