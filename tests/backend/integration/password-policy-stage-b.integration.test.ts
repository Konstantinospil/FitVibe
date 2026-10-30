/**
 * #557 Stage B: integration assertions against real Express, PostgreSQL, and
 * both credential formats. Only the HIBP network transport is controlled.
 */
import request from "supertest";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { breachedPasswordChecker } from "../../../apps/backend/src/modules/auth/breached-password.service.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { truncateAll, ensureRolesSeeded, createTestIp } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { HttpError } from "../../../apps/backend/src/utils/http.js";

const OLD = "ExistingPassword123!";
const NEW = "a completely different secure passphrase";
const email = "stage-b-user@example.com";

describeWithTestDatabase("Stage B: password writing and migration (#557)", () => {
  jest.setTimeout(90_000);
  let userId: string;

  beforeEach(async () => {
    await truncateAll();
    await ensureRolesSeeded();
    userId = uuidv4();
    await createUser({
      id: userId,
      username: "stageb-user",
      display_name: "Stage B User",
      password_hash: await bcrypt.hash(OLD, 12),
      primaryEmail: email,
      emailVerified: true,
      role_code: "athlete",
      status: "active",
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: getCurrentTermsVersion(),
    });
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("upgrades a verified legacy hash using a compare-and-swap and preserves login", async () => {
    const login = async () => request(app).post("/api/v1/auth/login")
      .set("X-Forwarded-For", createTestIp()).send({ email, password: OLD });

    const first = await login();
    expect(first.status).toBe(200);
    expect(first.body.requires2FA).toBe(false);
    const record = await db("users").where({ id: userId }).first();
    expect(record.password_hash).toMatch(/^\$argon2id\$v=19\$/);

    const second = await login();
    expect(second.status).toBe(200);
    expect(second.body.tokens.accessToken).toBeDefined();
  });

  it("rejects a breach-provider outage before registration persistence", async () => {
    const checker = jest.spyOn(breachedPasswordChecker, "assertAcceptable")
      .mockRejectedValueOnce(new HttpError(503, "BREACH_CHECK_UNAVAILABLE", "BREACH_CHECK_UNAVAILABLE"));
    const candidate = "new-stage-b@example.com";
    const response = await request(app).post("/api/v1/auth/register").send({
      email: candidate,
      username: "new-stage-b",
      password: "an original long passphrase for this test",
      terms_accepted: true,
    });
    expect(checker).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(503);
    const contact = await db("user_contacts").where({ value: candidate }).first();
    expect(contact).toBeUndefined();
  });

  it("preserves reset tokens and active sessions on screening outage; rejects reuse atomically", async () => {
    const signin = await request(app).post("/api/v1/auth/login")
      .set("X-Forwarded-For", createTestIp()).send({ email, password: OLD });
    expect(signin.status).toBe(200);
    const access = signin.body.tokens.accessToken;
    const forgot = async () => request(app).post("/api/v1/auth/password/forgot").send({ email });
    const firstToken = (await forgot()).body.debugResetToken;
    expect(firstToken).toEqual(expect.any(String));

    jest.spyOn(breachedPasswordChecker, "assertAcceptable")
      .mockRejectedValueOnce(new HttpError(503, "BREACH_CHECK_UNAVAILABLE", "BREACH_CHECK_UNAVAILABLE"));
    const outage = await request(app).post("/api/v1/auth/password/reset")
      .send({ token: firstToken, newPassword: NEW });
    expect(outage.status).toBe(503);
    expect((await db("auth_tokens").where({ user_id: userId, token_type: "password_reset" }).first()).consumed_at)
      .toBeNull();
    expect((await request(app).get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${access}`)).status).toBe(200);

    const updated = await request(app).post("/api/v1/auth/password/reset")
      .send({ token: firstToken, newPassword: NEW });
    expect(updated.status).toBe(204);
    const changed = await db("users").where({ id: userId }).first();
    expect(changed.password_hash).toMatch(/^\$argon2id\$/);
    expect((await db("user_password_history").where({ user_id: userId })).length).toBe(1);

    const nextToken = (await forgot()).body.debugResetToken;
    const reused = await request(app).post("/api/v1/auth/password/reset")
      .send({ token: nextToken, newPassword: OLD });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe("PASSWORD_REUSED");
    const stillActiveToken = await db("auth_tokens")
      .where({ user_id: userId, token_type: "password_reset", consumed_at: null }).first();
    expect(stillActiveToken).toBeDefined();
  });
});
