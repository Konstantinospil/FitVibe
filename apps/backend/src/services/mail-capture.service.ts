import { env } from "../config/env.js";
import type { MailMessage } from "./mailer.service.js";

/**
 * Non-production test mailbox (ADR-039).
 *
 * Email-first registration hands the continue link only to the mailbox, never
 * to the HTTP response. Local development and browser tests read it here, the
 * way a person reads their inbox. env.ts refuses to start production with
 * capture enabled, and the dev route that exposes it is not mounted unless
 * capture is enabled.
 */
export interface CapturedMail extends MailMessage {
  capturedAt: string;
}

const MAX_CAPTURED = 500;
const captured: CapturedMail[] = [];

export function isMailCaptureEnabled(): boolean {
  return env.email.captureEnabled && !env.isProduction;
}

export function captureMail(message: MailMessage): void {
  if (!isMailCaptureEnabled()) {
    return;
  }
  captured.push({ ...message, to: message.to.toLowerCase(), capturedAt: new Date().toISOString() });
  if (captured.length > MAX_CAPTURED) {
    captured.splice(0, captured.length - MAX_CAPTURED);
  }
}

/** Newest first. */
export function listCapturedMail(to?: string): CapturedMail[] {
  const recipient = to?.trim().toLowerCase();
  return captured.filter((mail) => !recipient || mail.to === recipient).reverse();
}

export function clearCapturedMail(): void {
  captured.length = 0;
}
