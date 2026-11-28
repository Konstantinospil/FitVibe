/**
 * Forgot-password answers identically for every address and delivers the
 * reset link only by email (ADR-039). Real Express, PostgreSQL and the
 * in-process job queue; only outbound mail is captured.
 */
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { PASSWORD_RESET_REQUESTED_MESSAGE } from "../../../apps/backend/src/modules/auth/auth.controller.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { clearRateLimiters } from "../../../apps/backend/src/middlewares/rate-limit.js";
import {
  mailerService,
  type MailMessage,
} from "../../../apps/backend/src/services/mailer.service.js";
import { truncateAll, ensureRolesSeeded, createTestIp } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";

const ACTIVE_EMAIL = "reset-owner@example.com";
const SUSPENDED_EMAIL = "reset-suspended@example.com";

async function seedAccount(email: string, status: "active" | "suspended") {
  const id = uuidv4();
  await createUser({
    id,
    username: email.split("@")[0],
    display_name: email.split("@")[0],
    password_hash: "unused-for-this-test",
    primaryEmail: email,
    emailVerified: true,
    role_code: "athlete",
    status,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: getCurrentTermsVersion(),
  });
  return id;
}

async function forgot(email: string) {
  return request(app)
    .post("/api/v1/auth/password/forgot")
    .set("X-Forwarded-For", createTestIp())
    .send({ email });
}

describeWithTestDatabase("Password reset delivers its link only by email (ADR-039)", () => {
  jest.setTimeout(60_000);
  let sent: MailMessage[];
  let sendSpy: jest.SpiedFunction<typeof mailerService.send>;
  let activeId: string;

  beforeEach(async () => {
    clearRateLimiters();
    await truncateAll();
    await ensureRolesSeeded();
    activeId = await seedAccount(ACTIVE_EMAIL, "active");
    await seedAccount(SUSPENDED_EMAIL, "suspended");
    sent = [];
    sendSpy = jest.spyOn(mailerService, "send").mockImplementation(async (mail) => {
      sent.push(mail);
    });
  });

  afterEach(async () => {
    sendSpy.mockRestore();
    clearRateLimiters();
    await truncateAll();
  });

  it("answers known, unknown and inactive addresses identically, with no token", async () => {
    const replies = [
      await forgot(ACTIVE_EMAIL),
      await forgot("nobody@example.com"),
      await forgot(SUSPENDED_EMAIL),
    ];

    for (const reply of replies) {
      expect(reply.status).toBe(202);
      expect(reply.body).toEqual({ message: PASSWORD_RESET_REQUESTED_MESSAGE });
    }
  });

  it("emails the reset link to an active account only", async () => {
    await forgot("nobody@example.com");
    await forgot(SUSPENDED_EMAIL);
    await forgot(ACTIVE_EMAIL);

    const deadline = Date.now() + 10_000;
    while (!sent.some((mail) => mail.to === ACTIVE_EMAIL) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    // Give any queued jobs for the other addresses time to finish too.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(sent.map((mail) => mail.to)).toEqual([ACTIVE_EMAIL]);
    const token = /\/reset-password\?token=([A-Za-z0-9_-]+)/.exec(sent[0].text ?? "")?.[1];
    expect(token).toBeDefined();
    const rows = await db("auth_tokens").where({ user_id: activeId, token_type: "password_reset" });
    expect(rows).toHaveLength(1);

    const reset = await request(app)
      .post("/api/v1/auth/password/reset")
      .set("X-Forwarded-For", createTestIp())
      .send({ token, newPassword: "a brand new long passphrase for reset" });
    expect(reset.status).toBe(200);
  });
});
