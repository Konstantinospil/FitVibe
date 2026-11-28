import crypto from "crypto";

/** Addresses are compared lowercased and trimmed throughout registration. */
export function normalizeRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Key for the per-address registration throttle (ADR-039). */
export function hashRegistrationEmail(email: string): string {
  return crypto.createHash("sha256").update(normalizeRegistrationEmail(email)).digest("hex");
}
