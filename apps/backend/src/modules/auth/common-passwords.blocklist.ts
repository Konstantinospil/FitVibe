/**
 * #557 — Owned, versioned denylist for obvious whole-secret passwords.
 * This is deliberately a small curated list; the HIBP range check provides
 * broader breach coverage. Do not use substring matching on passphrases.
 *
 * Source: FitVibe Security curated common/default credentials, 2026-10-26.
 * No third-party file or licensed password corpus is bundled.
 * Review on each password-policy release.
 */
export const COMMON_PASSWORD_LIST_VERSION = "2026-10-26.1";

const entries = [
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "123123",
  "111111",
  "000000",
  "123456789012",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password!",
  "password123!",
  "passw0rd",
  "p@ssw0rd",
  "p@ssword",
  "admin",
  "admin123",
  "administrator",
  "welcome",
  "welcome1",
  "welcome123",
  "letmein",
  "letmein123",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
  "football",
  "baseball",
  "trustno1",
  "changeme",
  "default",
  "secret",
  "test123",
  "testing123",
  "superuser",
  "root",
  "guest",
  "fitvibe",
  "fitvibe123",
  "fitvibe2026",
] as const;

const blocked = new Set<string>(entries);

export function isCommonPassword(password: string): boolean {
  return blocked.has(password.toLowerCase());
}
