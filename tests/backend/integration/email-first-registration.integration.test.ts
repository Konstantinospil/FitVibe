/**
 * Email-first registration (ADR-039, #653). Real Express, PostgreSQL and the
 * in-process job queue; only outbound mail is captured.
 *
 * Step 1 must answer identically for every address (new, existing, pending,
 * suspended, blocked, throttled) and reveal the real outcome only by email.
 * Step 2 belongs to whoever holds the emailed link.
 */
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import {
  mailerService,
  type MailMessage,
} from "../../../apps/backend/src/services/mailer.service.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { clearRateLimiters } from "../../../apps/backend/src/middlewares/rate-limit.js";
import { REGISTRATION_STARTED_MESSAGE } from "../../../apps/backend/src/modules/auth/auth.controller.js";
import {
  REGISTRATION_REQUESTS_PER_WINDOW,
  hashRegistrationEmail,
} from "../../../apps/backend/src/modules/auth/auth.registration.service.js";
import { truncateAll, ensureRolesSeeded, createTestIp } from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { clearRegistrationRequests } from "../../setup/registration-flow.js";

const PASSWORD = "an original long passphrase for registration";
const ACTIVE_EMAIL = "active-owner@example.com";

type Reply = { status: number; body: Record<string, unknown> };

async function start(email: string): Promise<Reply> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .set("X-Forwarded-For", createTestIp())
    .send({ email, locale: "en" });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function complete(fields: Record<string, unknown>): Promise<Reply> {
  const response = await request(app)
    .post("/api/v1/auth/register/complete")
    .set("X-Forwarded-For", createTestIp())
    .send({ password: PASSWORD, terms_accepted: true, ...fields });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function intentFor(token: string): Promise<Reply> {
  const response = await request(app)
    .post("/api/v1/auth/register/intent")
    .set("X-Forwarded-For", createTestIp())
    .send({ token });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function waitFor<T>(probe: () => Promise<T | undefined> | T | undefined, label: string) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await probe();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function requestRowsFor(email: string): Promise<number> {
  const rows = await db("registration_intents")
    .where({ email_hash: hashRegistrationEmail(email) })
    .count<{ count: string }[]>({ count: "*" });
  return Number(rows[0].count);
}

/** The job has run once every request for the address has left its row. */
async function settled(email: string, expectedRows: number) {
  await waitFor(
    async () => ((await requestRowsFor(email)) >= expectedRows ? true : undefined),
    `${expectedRows} registration rows for ${email}`,
  );
  // Let the mail send that follows the insert finish.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function continueToken(mail: MailMessage): string {
  const match = /\/register\/complete\?token=([A-Za-z0-9_-]+)/.exec(mail.text ?? "");
  if (!match) {
    throw new Error(`No continue link in: ${mail.subject}`);
  }
  return match[1];
}

async function seedAccount(email: string, alias: string, status: string) {
  await createUser({
    id: uuidv4(),
    username: alias,
    display_name: alias,
    password_hash: "unused-for-this-test",
    primaryEmail: email,
    emailVerified: status === "active",
    role_code: "athlete",
    status: status as "active",
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: getCurrentTermsVersion(),
  });
}

describeWithTestDatabase("Email-first registration (ADR-039)", () => {
  jest.setTimeout(120_000);
  let sent: MailMessage[];
  let sendSpy: jest.SpiedFunction<typeof mailerService.send>;

  const mailTo = (email: string) => sent.filter((mail) => mail.to === email);

  beforeEach(async () => {
    clearRateLimiters();
    await truncateAll();
    await clearRegistrationRequests();
    await ensureRolesSeeded();
    await seedAccount(ACTIVE_EMAIL, "active-owner", "active");
    sent = [];
    sendSpy = jest.spyOn(mailerService, "send").mockImplementation(async (mail) => {
      sent.push(mail);
    });
  });

  afterEach(async () => {
    sendSpy.mockRestore();
    clearRateLimiters();
    await clearRegistrationRequests();
    await truncateAll();
  });

  it("answers every kind of address identically and tells only the mailbox", async () => {
    await seedAccount("pending@example.com", "pending-owner", "pending_verification");
    await seedAccount("suspended@example.com", "suspended-owner", "suspended");
    await db("blacklist").insert({ email: "blocked@example.com" });

    const addresses = [
      "brand-new@example.com",
      ACTIVE_EMAIL,
      "pending@example.com",
      "suspended@example.com",
      "blocked@example.com",
    ];
    const replies = [];
    for (const address of addresses) {
      replies.push(await start(address));
    }

    for (const reply of replies) {
      expect(reply.status).toBe(202);
      expect(reply.body).toEqual({ message: REGISTRATION_STARTED_MESSAGE });
    }

    for (const address of addresses) {
      await settled(address, 1);
    }
    expect(mailTo("brand-new@example.com").map((m) => m.subject)).toEqual([
      "Finish creating your FitVibe account",
    ]);
    expect(mailTo(ACTIVE_EMAIL).map((m) => m.subject)).toEqual([
      "Someone tried to register with your FitVibe email address",
    ]);
    expect(mailTo("pending@example.com").map((m) => m.subject)).toEqual([
      "Verify your FitVibe account",
    ]);
    expect(mailTo("suspended@example.com")).toHaveLength(0);
    expect(mailTo("blocked@example.com")).toHaveLength(0);

    // Step 1 never creates an account.
    expect(await db("user_contacts").where({ value: "brand-new@example.com" })).toHaveLength(0);
  });

  it("throttles each address the same way, silently, whether or not it has an account", async () => {
    const fresh = "throttle-new@example.com";
    const attempts = REGISTRATION_REQUESTS_PER_WINDOW + 2;

    const replies = [];
    for (let i = 0; i < attempts; i += 1) {
      replies.push(await start(fresh));
      replies.push(await start(ACTIVE_EMAIL));
    }
    for (const reply of replies) {
      expect(reply.status).toBe(202);
      expect(reply.body).toEqual({ message: REGISTRATION_STARTED_MESSAGE });
    }

    await settled(fresh, REGISTRATION_REQUESTS_PER_WINDOW);
    await settled(ACTIVE_EMAIL, REGISTRATION_REQUESTS_PER_WINDOW);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mailTo(fresh)).toHaveLength(REGISTRATION_REQUESTS_PER_WINDOW);
    expect(mailTo(ACTIVE_EMAIL)).toHaveLength(REGISTRATION_REQUESTS_PER_WINDOW);
    expect(await requestRowsFor(fresh)).toBe(REGISTRATION_REQUESTS_PER_WINDOW);
    expect(await requestRowsFor(ACTIVE_EMAIL)).toBe(REGISTRATION_REQUESTS_PER_WINDOW);
  });

  it("creates an active, verified account for the link holder and consumes the link", async () => {
    const email = "complete-me@example.com";
    await start(email);
    await settled(email, 1);
    const token = continueToken(mailTo(email)[0]);

    const intent = await intentFor(token);
    expect(intent.status).toBe(200);
    expect(intent.body).toMatchObject({ email });

    const done = await complete({ token, username: "complete-me" });
    expect(done.status).toBe(201);
    expect(done.body.user).toMatchObject({ email, username: "complete-me", status: "active" });

    const contact = await db("user_contacts").where({ value: email }).first();
    expect(contact).toMatchObject({ is_verified: true });
    const user = await db("users").where({ id: contact.user_id }).first();
    expect(user).toMatchObject({ status: "active", terms_accepted: true });

    // Single use.
    expect((await complete({ token, username: "complete-me-again" })).status).toBe(400);
    expect((await intentFor(token)).status).toBe(400);
    expect(await db("user_contacts").where({ value: email })).toHaveLength(1);
  });

  it("only honours the newest link for an address", async () => {
    const email = "newest-link@example.com";
    await start(email);
    await settled(email, 1);
    await start(email);
    await settled(email, 2);
    const [first, second] = mailTo(email).map(continueToken);

    expect((await intentFor(first)).status).toBe(400);
    expect((await complete({ token: second, username: "newest-link" })).status).toBe(201);
  });

  it("reports a taken username to the link holder and keeps the link usable", async () => {
    const email = "alias-clash@example.com";
    await start(email);
    await settled(email, 1);
    const token = continueToken(mailTo(email)[0]);

    const clash = await complete({ token, username: "active-owner" });
    expect(clash.status).toBe(409);
    expect(clash.body).toMatchObject({ error: { code: "USER_USERNAME_TAKEN" } });

    expect((await complete({ token, username: "alias-clash" })).status).toBe(201);
  });

  it("rejects an expired link with 410", async () => {
    const email = "expired-link@example.com";
    await start(email);
    await settled(email, 1);
    const token = continueToken(mailTo(email)[0]);
    await db("registration_intents")
      .where({ email_hash: hashRegistrationEmail(email) })
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() });

    expect((await intentFor(token)).status).toBe(410);
    expect((await complete({ token, username: "expired-link" })).status).toBe(410);
    expect(await db("user_contacts").where({ value: email })).toHaveLength(0);
  });

  it("lets only one of several concurrent submissions of a link create the account", async () => {
    const email = "race-link@example.com";
    await start(email);
    await settled(email, 1);
    const token = continueToken(mailTo(email)[0]);

    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => complete({ token, username: `race-link-${i}` })),
    );
    const created = results.filter((result) => result.status === 201);
    expect(created).toHaveLength(1);
    for (const result of results.filter((r) => r.status !== 201)) {
      expect(result.status).toBe(400);
    }
    expect(await db("user_contacts").where({ value: email })).toHaveLength(1);
    expect(await db("profiles").where("alias", "like", "race-link-%")).toHaveLength(1);
    const orphanUsers = await db("users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .whereNull("p.user_id");
    expect(orphanUsers).toHaveLength(0);
  });

  it("never returns a token or link in any response", async () => {
    const reply = await start("no-debug@example.com");
    expect(JSON.stringify(reply.body)).not.toMatch(/token|verify|register\/complete/i);
  });

  it("does not expose the test mailbox unless capture is enabled", async () => {
    const response = await request(app).get("/api/v1/dev/mail");
    expect(response.status).toBe(404);
  });
});
