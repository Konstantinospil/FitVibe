/**
 * Integration-test helpers for links that reach only the mailbox (ADR-039):
 * email-first registration and password reset. No response carries a token,
 * so these helpers capture the outgoing mail and return the link token, the
 * way a person would read it from their inbox.
 */
import request from "supertest";
import type { Express } from "express";
import db from "../../apps/backend/src/db/index.js";
import { hashRegistrationEmail } from "../../apps/backend/src/modules/auth/auth.registration-email.js";
import { mailerService, type MailMessage } from "../../apps/backend/src/services/mailer.service.js";

const REGISTRATION_LINK = /\/register\/complete\?token=([A-Za-z0-9_-]+)/;
const RESET_LINK = /\/reset-password\?token=([A-Za-z0-9_-]+)/;

/**
 * Run `trigger` with outgoing mail captured, then wait until a message to
 * `email` contains a link matching `pattern` and return its token.
 */
async function captureEmailedToken(
  email: string,
  pattern: RegExp,
  trigger: () => Promise<request.Response>,
): Promise<string> {
  const sent: MailMessage[] = [];
  const spy = jest.spyOn(mailerService, "send").mockImplementation(async (message) => {
    sent.push(message);
  });
  try {
    const response = await trigger();
    if (response.status !== 202) {
      throw new Error(`Request that should email a link failed: HTTP ${response.status}`);
    }
    const deadline = Date.now() + 10_000;
    for (;;) {
      const mail = sent.find(
        (message) => message.to === email.toLowerCase() && pattern.test(message.text ?? ""),
      );
      if (mail) {
        return pattern.exec(mail.text ?? "")?.[1] as string;
      }
      if (Date.now() > deadline) {
        throw new Error(`No link was emailed to ${email}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    spy.mockRestore();
  }
}

/**
 * Forget earlier registration requests for an address so the per-address
 * throttle cannot carry over between tests that reuse it.
 */
export async function clearRegistrationRequests(email?: string): Promise<void> {
  const query = db("registration_intents");
  await (email ? query.where({ email_hash: hashRegistrationEmail(email) }).del() : query.del());
}

export async function obtainRegistrationLinkToken(app: Express, email: string): Promise<string> {
  await clearRegistrationRequests(email);
  return captureEmailedToken(email, REGISTRATION_LINK, () =>
    request(app).post("/api/v1/auth/register").send({ email, locale: "en" }),
  );
}

/** Run both registration steps and return the step-2 response. */
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

/**
 * Request a password reset and return the token from the emailed link. The
 * token row exists once the mail is sent, so callers may also read it from
 * the database afterwards.
 */
export async function obtainPasswordResetToken(
  app: Express,
  email: string,
  ip?: string,
): Promise<string> {
  return captureEmailedToken(email, RESET_LINK, () => {
    const call = request(app).post("/api/v1/auth/password/forgot");
    return (ip ? call.set("X-Forwarded-For", ip) : call).send({ email });
  });
}
