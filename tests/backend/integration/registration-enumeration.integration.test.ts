/**
 * #653 / #553 finding 2: registration must not reveal whether an email has an
 * account, and concurrent registrations must stay consistent. Real Express and
 * PostgreSQL; only outbound mail is captured.
 */
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { env } from "../../../apps/backend/src/config/env.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { mailerService } from "../../../apps/backend/src/services/mailer.service.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { truncateAll, ensureRolesSeeded, createTestIp } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { clearRateLimiters } from "../../../apps/backend/src/middlewares/rate-limit.js";

const PASSWORD = "an original long passphrase for registration";
const EXISTING_EMAIL = "existing-owner@example.com";

type RegisterResult = { status: number; body: Record<string, unknown> };

async function register(emailAddress: string, alias: string): Promise<RegisterResult> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .set("X-Forwarded-For", createTestIp())
    .send({ email: emailAddress, username: alias, password: PASSWORD, terms_accepted: true });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

/**
 * Non-production builds add the verification token to the body as a local
 * debugging aid (the controller omits it when NODE_ENV=production). Everything
 * else in the public response must be identical.
 */
function publicBody(body: Record<string, unknown>): Record<string, unknown> {
  const { debugVerificationToken: _token, verificationUrl: _url, ...rest } = body;
  return rest;
}

async function countAccountsFor(emailAddress: string): Promise<number> {
  const rows = await db("user_contacts")
    .where({ type: "email", value: emailAddress })
    .count<{ count: string }[]>({ count: "*" });
  return Number(rows[0].count);
}

describeWithTestDatabase("Registration does not reveal account existence (#653)", () => {
  jest.setTimeout(120_000);
  const originalEmailEnabled = env.email.enabled;
  let sendSpy: jest.SpiedFunction<typeof mailerService.send>;

  beforeEach(async () => {
    clearRateLimiters();
    await truncateAll();
    await ensureRolesSeeded();
    await createUser({
      id: uuidv4(),
      username: "existing-owner",
      display_name: "Existing Owner",
      password_hash: "unused-for-this-test",
      primaryEmail: EXISTING_EMAIL,
      emailVerified: true,
      role_code: "athlete",
      status: "active",
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: getCurrentTermsVersion(),
    });
    (env.email as { enabled: boolean }).enabled = true;
    sendSpy = jest.spyOn(mailerService, "send").mockResolvedValue(undefined);
  });

  afterEach(async () => {
    (env.email as { enabled: boolean }).enabled = originalEmailEnabled;
    sendSpy.mockRestore();
    clearRateLimiters();
    await truncateAll();
  });

  it("answers an existing verified email exactly like a new one and notifies the owner", async () => {
    const fresh = await register("brand-new@example.com", "brand-new-alias");
    sendSpy.mockClear();
    const existing = await register(EXISTING_EMAIL, "another-alias");

    expect(fresh.status).toBe(202);
    expect(existing.status).toBe(fresh.status);
    expect(publicBody(existing.body)).toEqual(publicBody(fresh.body));

    expect(await countAccountsFor(EXISTING_EMAIL)).toBe(1);
    expect(await db("profiles").where({ alias: "another-alias" }).first()).toBeUndefined();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: EXISTING_EMAIL,
        subject: "Someone tried to register with your FitVibe email address",
        text: expect.stringContaining(`${env.frontendUrl}/forgot-password`),
      }),
    );
  });

  it("takes about as long for an existing email as for a new one", async () => {
    const runs = 4;
    const timed = async (emailFor: (i: number) => string, aliasPrefix: string) => {
      let total = 0;
      for (let i = 0; i < runs; i += 1) {
        const start = Date.now();
        const result = await register(emailFor(i), `${aliasPrefix}-${i}`);
        total += Date.now() - start;
        expect(result.status).toBe(202);
      }
      return total / runs;
    };

    // Warm up connections and the hashing path so the first sample is not an outlier.
    await register("warmup@example.com", "warmup-alias");

    const freshMs = await timed((i) => `timing-new-${i}@example.com`, "timing-new");
    const existingMs = await timed(() => EXISTING_EMAIL, "timing-existing");

    const variance = (Math.abs(freshMs - existingMs) / ((freshMs + existingMs) / 2)) * 100;
    expect(variance).toBeLessThanOrEqual(25);
  });

  it("creates exactly one account for concurrent registrations of one email, all answered alike", async () => {
    const raceEmail = "race-email@example.com";
    // Three requests: later ones can land on the winner's pending account and
    // take the resend path, whose AC-1.8 cap (3 per hour) answers 429 on the 4th.
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) => register(raceEmail, `race-email-${i}`)),
    );

    for (const result of results) {
      expect(result.status).toBe(202);
      expect(publicBody(result.body)).toEqual(publicBody(results[0].body));
    }
    expect(await countAccountsFor(raceEmail)).toBe(1);

    const contact = await db("user_contacts").where({ value: raceEmail }).first();
    expect(await db("users").where({ id: contact.user_id }).first()).toBeDefined();
    const profiles = await db("profiles").where("alias", "like", "race-email-%");
    expect(profiles).toHaveLength(1);
    expect(profiles[0].user_id).toBe(contact.user_id);
  });

  it("lets one of several concurrent registrations claim an alias and reports the rest as taken", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => register(`race-alias-${i}@example.com`, "race-alias")),
    );

    const accepted = results.filter((result) => result.status === 202);
    const rejected = results.filter((result) => result.status !== 202);
    expect(accepted).toHaveLength(1);
    for (const result of rejected) {
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ error: { code: "USER_USERNAME_TAKEN" } });
    }
    expect(await db("profiles").where({ alias: "race-alias" })).toHaveLength(1);

    // Losers leave no partial rows behind.
    const contacts = await db("user_contacts").where("value", "like", "race-alias-%@example.com");
    expect(contacts).toHaveLength(1);
    const orphanUsers = await db("users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .whereNull("p.user_id");
    expect(orphanUsers).toHaveLength(0);
  });

  it("reports a taken alias identically whether or not the email is registered", async () => {
    const withNewEmail = await register("unregistered@example.com", "existing-owner");
    const withExistingEmail = await register(EXISTING_EMAIL, "existing-owner");

    expect(withNewEmail.status).toBe(409);
    expect(withExistingEmail.status).toBe(409);
    expect(withExistingEmail.body.error).toMatchObject({ code: "USER_USERNAME_TAKEN" });
    const { requestId: _a, ...newError } = withNewEmail.body.error as Record<string, unknown>;
    const { requestId: _b, ...existingError } = withExistingEmail.body.error as Record<
      string,
      unknown
    >;
    expect(existingError).toEqual(newError);
  });
});
