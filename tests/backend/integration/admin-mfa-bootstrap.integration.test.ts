/**
 * Stage A (#557): production bootstrap and administrator MFA policy through the
 * real Express API, PostgreSQL repositories, session cookies and TOTP verifier.
 *
 * This suite uses a disposable test database (never production credentials).
 * Test ownership: backend-jest / integration, authentication-policy #557.
 */
import request from "supertest";
import bcrypt from "bcryptjs";
import { verifyPasswordHash } from "../../../apps/backend/src/modules/auth/password-hashing.service.js";
import { authenticator } from "@otplib/preset-default";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { env } from "../../../apps/backend/src/config/env.js";
import { seed as seedBootstrapAdmin } from "../../../apps/backend/src/db/seeds/005_users.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { verifyAccess } from "../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import { truncateAll, createTestIp, ensureRolesSeeded } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const PASSWORD = "StageA-Admin-Password-2026!";
const REPLACEMENT_PASSWORD = "StageA-Replaced-Password-2026!";

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function cookieHeader(response: { headers: Record<string, unknown> }): string {
  const values = response.headers["set-cookie"];
  if (!Array.isArray(values)) throw new Error("Authentication response omitted session cookies");
  return values.map((value: string) => value.split(";")[0]).join("; ");
}

function cookieValue(response: { headers: Record<string, unknown> }, name: string): string {
  const values = response.headers["set-cookie"];
  if (!Array.isArray(values)) throw new Error("Missing authentication cookies");
  const found = values
    .map((value: string) => value.split(";")[0])
    .find((value: string) => value.startsWith(`${name}=`));
  if (!found) throw new Error(`Authentication did not issue ${name} cookie`);
  return found.slice(name.length + 1);
}

describeWithTestDatabase("Stage A administrator MFA bootstrap and recovery (#557)", () => {
  jest.setTimeout(90_000);
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  const previousReadOnly = env.readOnlyMode;
  const previousTrustProxy = env.trustProxy;

  beforeEach(async () => {
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    (env as { trustProxy: boolean }).trustProxy = true;
    process.env.ADMIN_PASSWORD = PASSWORD;
    await truncateAll();
    await ensureRolesSeeded();
  });

  afterEach(async () => {
    await truncateAll();
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
    (env as { readOnlyMode: boolean }).readOnlyMode = previousReadOnly;
    (env as { trustProxy: boolean }).trustProxy = previousTrustProxy;
  });

  it("bootstraps, restricts, enrolls TOTP, reauthenticates, refreshes, recovers and rechallenges after reset", async () => {
    // Exercise the actual production bootstrap seed, not a synthetic admin JWT.
    await seedBootstrapAdmin(db);
    const seeded = await db("users").where({ id: ADMIN_ID }).first();
    expect(seeded.role_code).toBe("admin");
    expect(await verifyPasswordHash(PASSWORD, seeded.password_hash)).toBe(true);
    expect(seeded.password_hash).toMatch(/^\$argon2id\$/);
    expect(seeded.password_hash).not.toBe(PASSWORD);
    // Restarting bootstrap must not replace the existing administrator secret
    // or reset the original account's security state.
    await seedBootstrapAdmin(db);
    const restarted = await db("users").where({ id: ADMIN_ID }).first();
    expect(restarted.password_hash).toBe(seeded.password_hash);

    const ip = createTestIp();
    const login = (password = PASSWORD) =>
      request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ip)
        .send({ email: "admin@fitvibe.local", password });

    const passwordStage = await login();
    expect(passwordStage.status).toBe(200);
    expect(passwordStage.body.requires2FA).toBe(false);
    const passwordOnlyAccess: string = passwordStage.body.tokens.accessToken;
    const passwordOnlyRefresh: string = passwordStage.body.tokens.refreshToken;
    expect(verifyAccess(passwordOnlyAccess)).toMatchObject({ role: "admin", mfa: false });

    const blocked = await request(app).get("/api/v1/auth/sessions")
      .set(auth(passwordOnlyAccess));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("ADMIN_2FA_REQUIRED");

    const status = await request(app).get("/api/v1/auth/2fa/status")
      .set(auth(passwordOnlyAccess));
    expect(status.status).toBe(200);
    expect(status.body.enabled).toBe(false);

    const dismiss = await request(app).post("/api/v1/auth/2fa/invitation/dismiss")
      .set(auth(passwordOnlyAccess));
    // The global administrator MFA boundary denies dismissal before the route
    // handler executes. This is intentional defense in depth.
    expect(dismiss.status).toBe(403);
    expect(dismiss.body.error.code).toBe("ADMIN_2FA_REQUIRED");
    expect(await db("user_2fa_invitations").where({ user_id: ADMIN_ID }).first()).toBeUndefined();

    const setup = await request(app).get("/api/v1/auth/2fa/setup")
      .set(auth(passwordOnlyAccess));
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toEqual(expect.any(String));
    expect(setup.body.backupCodes).toHaveLength(10);

    const invalid = await request(app).post("/api/v1/auth/2fa/verify")
      .set(auth(passwordOnlyAccess))
      .send({ code: authenticator.generate(setup.body.secret) === "000000" ? "000001" : "000000" });
    expect(invalid.status).toBe(401);
    expect((await db("user_2fa_settings").where({ user_id: ADMIN_ID }).first()).is_enabled).toBe(false);

    const enabled = await request(app).post("/api/v1/auth/2fa/verify")
      .set(auth(passwordOnlyAccess))
      .send({ code: authenticator.generate(setup.body.secret) });
    expect(enabled.status).toBe(200);
    expect((await db("user_2fa_settings").where({ user_id: ADMIN_ID }).first()).is_verified).toBe(true);

    // Enrollment alone does NOT upgrade the password-only session.
    const staleAccess = await request(app).get("/api/v1/auth/sessions")
      .set(auth(passwordOnlyAccess));
    expect(staleAccess.status).toBe(403);
    const staleRefresh = await request(app).post("/api/v1/auth/refresh")
      .set("Cookie", `${env.REFRESH_COOKIE_NAME}=${passwordOnlyRefresh}`);
    expect(staleRefresh.status).toBe(403);

    const challenge = await login();
    expect(challenge.body).toMatchObject({
      requires2FA: true,
      pendingSessionId: expect.any(String),
    });
    expect(challenge.body.tokens).toBeUndefined();
    const pendingSessionId: string = challenge.body.pendingSessionId;
    const rejectedCode = await request(app).post("/api/v1/auth/login/verify-2fa")
      .set("X-Forwarded-For", ip)
      .send({
        pendingSessionId,
        code: authenticator.generate(setup.body.secret) === "000000" ? "000001" : "000000",
      });
    expect(rejectedCode.status).toBe(401);

    const verified = await request(app).post("/api/v1/auth/login/verify-2fa")
      .set("X-Forwarded-For", ip)
      .send({ pendingSessionId, code: authenticator.generate(setup.body.secret) });
    expect(verified.status).toBe(200);
    expect(verifyAccess(verified.body.tokens.accessToken)).toMatchObject({ role: "admin", mfa: true });

    // A fully MFA-attested administrator reaches the route, where the persisted
    // administrator role still forbids dismissing mandatory MFA.
    const dismissalAfterMfa = await request(app)
      .post("/api/v1/auth/2fa/invitation/dismiss")
      .set(auth(verified.body.tokens.accessToken));
    expect(dismissalAfterMfa.status).toBe(409);
    expect(dismissalAfterMfa.body.error.code).toBe("ADMIN_2FA_REQUIRED");
    expect(await db("user_2fa_invitations").where({ user_id: ADMIN_ID }).first()).toBeUndefined();

    const authenticated = await request(app).get("/api/v1/auth/sessions")
      .set("Cookie", cookieHeader(verified));
    expect(authenticated.status).toBe(200);

    const refresh = await request(app).post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(verified));
    expect(refresh.status).toBe(200);
    const rotatedRefresh = cookieValue(refresh, env.REFRESH_COOKIE_NAME);
    expect(rotatedRefresh).not.toBe(verified.body.tokens.refreshToken);
    const afterRefresh = await request(app).get("/api/v1/auth/sessions")
      .set("Cookie", cookieHeader(refresh));
    expect(afterRefresh.status).toBe(200);

    // Recovery is a real second factor, consumed once, never a password-only shortcut.
    const recoveryChallenge = await login();
    expect(recoveryChallenge.body.requires2FA).toBe(true);
    const recovered = await request(app).post("/api/v1/auth/login/verify-2fa")
      .set("X-Forwarded-For", ip)
      .send({
        pendingSessionId: recoveryChallenge.body.pendingSessionId,
        code: setup.body.backupCodes[0],
      });
    expect(recovered.status).toBe(200);
    expect(verifyAccess(recovered.body.tokens.accessToken).mfa).toBe(true);
    expect(await db("backup_codes").where({ user_id: ADMIN_ID, is_used: true }).count("id as count"))
      .toEqual([expect.objectContaining({ count: "1" })]);

    const replayChallenge = await login();
    const replay = await request(app).post("/api/v1/auth/login/verify-2fa")
      .set("X-Forwarded-For", ip)
      .send({
        pendingSessionId: replayChallenge.body.pendingSessionId,
        code: setup.body.backupCodes[0],
      });
    expect(replay.status).toBe(401);

    const forgot = await request(app).post("/api/v1/auth/password/forgot")
      .send({ email: "admin@fitvibe.local" });
    expect(forgot.status).toBe(202);
    expect(forgot.body.debugResetToken).toEqual(expect.any(String));
    const resetRow = await db("auth_tokens")
      .where({ user_id: ADMIN_ID, token_type: "password_reset" })
      .orderBy("created_at", "desc").first();
    expect(new Date(resetRow.expires_at).getTime() - new Date(resetRow.created_at).getTime())
      .toBeLessThanOrEqual(15 * 60 * 1000);

    const reset = await request(app).post("/api/v1/auth/password/reset")
      .send({ token: forgot.body.debugResetToken, newPassword: REPLACEMENT_PASSWORD });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({});
    const revoked = await request(app).get("/api/v1/auth/sessions")
      .set("Cookie", cookieHeader(refresh));
    expect(revoked.status).toBe(401);
    const revokedRefresh = await request(app).post("/api/v1/auth/refresh")
      .set("Cookie", `${env.REFRESH_COOKIE_NAME}=${rotatedRefresh}`);
    expect(revokedRefresh.status).toBe(401);

    // Existing enrolled TOTP survives reset; no privileged password-only login.
    const afterReset = await login(REPLACEMENT_PASSWORD);
    expect(afterReset.body.requires2FA).toBe(true);
    const reverified = await request(app).post("/api/v1/auth/login/verify-2fa")
      .set("X-Forwarded-For", ip)
      .send({
        pendingSessionId: afterReset.body.pendingSessionId,
        code: authenticator.generate(setup.body.secret),
      });
    expect(reverified.status).toBe(200);
    expect(verifyAccess(reverified.body.tokens.accessToken)).toMatchObject({ role: "admin", mfa: true });
    expect((await request(app).get("/api/v1/auth/sessions")
      .set("Cookie", cookieHeader(reverified))).status).toBe(200);
  });

  it("fails closed for role promotion and suspended or deleted accounts", async () => {
    const userId = uuidv4();
    const email = `stage-a-${uuidv4()}@example.com`;
    await createUser({
      id: userId,
      username: `stagea-${uuidv4().slice(0, 8)}`,
      display_name: "Stage A Athlete",
      password_hash: await bcrypt.hash(PASSWORD, 12),
      primaryEmail: email,
      emailVerified: true,
      role_code: "athlete",
      status: "active",
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: "2024-06-01",
    });
    const originalLogin = await request(app).post("/api/v1/auth/login")
      .set("X-Forwarded-For", createTestIp())
      .send({ email, password: PASSWORD });
    expect(originalLogin.status).toBe(200);
    expect(originalLogin.body.requires2FA).toBe(false);
    const athleteAccess = originalLogin.body.tokens.accessToken;
    expect((await request(app).get("/api/v1/auth/sessions")
      .set(auth(athleteAccess))).status).toBe(200);

    // Direct persisted role mutation simulates pre-existing sessions at the
    // security boundary; transaction-level revocation is tested separately.
    await db("users").where({ id: userId }).update({ role_code: "admin" });
    const promotedAccess = await request(app).get("/api/v1/auth/sessions")
      .set(auth(athleteAccess));
    expect(promotedAccess.status).toBe(403);
    const promotedRefresh = await request(app).post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader(originalLogin));
    expect(promotedRefresh.status).toBe(403);

    for (const status of ["suspended", "deleted"]) {
      await db("users").where({ id: userId }).update({ status });
      const inactive = await request(app).get("/api/v1/auth/sessions")
        .set(auth(athleteAccess));
      expect(inactive.status).toBe(401);
    }
  });
});
