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
import { changePasswordAndRevokeAuthAtomic } from "../../../apps/backend/src/modules/auth/auth.state.repository.js";
import { hashPassword, verifyPasswordHash } from "../../../apps/backend/src/modules/auth/password-hashing.service.js";
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

  it("allows registration on breach-provider outage and returns a warning", async () => {
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
    expect(response.status).toBe(202);
    expect(response.body.passwordWarning).toBe("BREACH_CHECK_UNAVAILABLE");
    const contact = await db("user_contacts").where({ value: candidate }).first();
    expect(contact).toBeDefined();
    checker.mockRestore();
  });

  it("allows reset on screening outage, revokes sessions and rejects reuse atomically", async () => {
    const signin = await request(app).post("/api/v1/auth/login")
      .set("X-Forwarded-For", createTestIp()).send({ email, password: OLD });
    expect(signin.status).toBe(200);
    const access = signin.body.tokens.accessToken;
    const forgot = async () => request(app).post("/api/v1/auth/password/forgot").send({ email });
    const firstToken = (await forgot()).body.debugResetToken;
    expect(firstToken).toEqual(expect.any(String));

    const checker = jest.spyOn(breachedPasswordChecker, "assertAcceptable")
      .mockRejectedValueOnce(new HttpError(503, "BREACH_CHECK_UNAVAILABLE", "BREACH_CHECK_UNAVAILABLE"));
    const updated = await request(app).post("/api/v1/auth/password/reset")
      .send({ token: firstToken, newPassword: NEW });
    expect(updated.status).toBe(200);
    expect(updated.body.passwordWarning).toBe("BREACH_CHECK_UNAVAILABLE");
    expect(checker).toHaveBeenCalledTimes(1);
    checker.mockRestore();

    expect((await db("auth_tokens").where({ user_id: userId, token_type: "password_reset" }).first()).consumed_at)
      .not.toBeNull();
    expect((await request(app).get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${access}`)).status).toBe(401);

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
  it("serializes simultaneous changes with the same old password", async () => {
    const candidateA = "a new original passphrase for the first request";
    const candidateB = "a different original passphrase for the second request";
    const [hashA, hashB] = await Promise.all([
      hashPassword(candidateA),
      hashPassword(candidateB),
    ]);

    const attempts = await Promise.allSettled([
      changePasswordAndRevokeAuthAtomic(userId, hashA, candidateA, OLD),
      changePasswordAndRevokeAuthAtomic(userId, hashB, candidateB, OLD),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failures = attempts.filter((result) => result.status === "rejected");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ status: 401, code: "USER_INVALID_PASSWORD" }),
    });

    const actual = await db("users").where({ id: userId }).first("password_hash");
    expect(actual).toBeDefined();
    const aValid = await verifyPasswordHash(candidateA, actual.password_hash);
    const bValid = await verifyPasswordHash(candidateB, actual.password_hash);
    expect([aValid, bValid].filter(Boolean)).toHaveLength(1);
    expect(await verifyPasswordHash(OLD, actual.password_hash)).toBe(false);
    const history = await db("user_password_history").where({ user_id: userId });
    expect(history).toHaveLength(1);
    expect(await verifyPasswordHash(OLD, history[0].password_hash)).toBe(true);
  });

});
