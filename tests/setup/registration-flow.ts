/**
 * Integration-test helper for email-first registration (ADR-039).
 *
 * Step 1 never returns a token; the continue link goes only to the mailbox.
 * These helpers start registration, capture the outgoing mail and return the
 * link token, the way a person would read it from their inbox.
 */
import request from "supertest";
import type { Express } from "express";
import db from "../../apps/backend/src/db/index.js";
import { hashRegistrationEmail } from "../../apps/backend/src/modules/auth/auth.registration-email.js";
import { mailerService, type MailMessage } from "../../apps/backend/src/services/mailer.service.js";

const LINK_PATTERN = /\/register\/complete\?token=([A-Za-z0-9_-]+)/;

/**
 * Forget earlier requests for an address so the per-address throttle cannot
 * carry over between tests that reuse it.
 */
export async function clearRegistrationRequests(email?: string): Promise<void> {
  const query = db("registration_intents");
  await (email ? query.where({ email_hash: hashRegistrationEmail(email) }).del() : query.del());
}

export async function obtainRegistrationLinkToken(app: Express, email: string): Promise<string> {
  await clearRegistrationRequests(email);
  const sent: MailMessage[] = [];
  const spy = jest.spyOn(mailerService, "send").mockImplementation(async (message) => {
    sent.push(message);
  });
  try {
    const response = await request(app).post("/api/v1/auth/register").send({ email, locale: "en" });
    if (response.status !== 202) {
      throw new Error(`Registration start failed: HTTP ${response.status}`);
    }
    const deadline = Date.now() + 10_000;
    for (;;) {
      const mail = sent.find(
        (message) => message.to === email.toLowerCase() && LINK_PATTERN.test(message.text ?? ""),
      );
      if (mail) {
        return LINK_PATTERN.exec(mail.text ?? "")?.[1] as string;
      }
      if (Date.now() > deadline) {
        throw new Error(`No registration link was emailed to ${email}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    spy.mockRestore();
  }
}

/** Run both steps and return the step-2 response. */
export async function registerThroughEmail(
  app: Express,
  account: { email: string; username: string; password: string; profile?: Record<string, unknown> },
) {
  const token = await obtainRegistrationLinkToken(app, account.email);
  return request(app)
    .post("/api/v1/auth/register/complete")
    .send({
      token,
      username: account.username,
      password: account.password,
      terms_accepted: true,
      ...(account.profile ? { profile: account.profile } : {}),
    });
}
