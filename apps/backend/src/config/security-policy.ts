/**
 * Code-owned authentication security policy.
 *
 * These values are not administrator-tunable application settings. They are
 * security invariants or code-reviewed security parameters. Governed settings
 * may strengthen a floor (for example password length) but cannot weaken it.
 */
export const AUTH_SECURITY_POLICY = {
  password: {
    minLengthFloor: 12,
    privilegedMinLengthFloor: 16,
    maxLength: 128,
    hashCost: 12,
  },
  account: {
    usernameMinLength: 3,
    usernameMaxLength: 50,
    // RFC 5321 limit for a forward path, the longest address a mail server accepts.
    emailMaxLength: 254,
    minAgeYears: 13,
    maxAgeYears: 120,
  },
  // One-time links (verification, reset, registration, contact): random bytes
  // encoded as base64url, and the length range a submitted token may have.
  linkToken: {
    randomBytes: 32,
    minLength: 20,
    maxLength: 128,
  },
  timing: {
    minOperationMs: 300,
    jitterMs: 10,
    maxVariancePercent: 10,
  },
  totp: {
    stepSeconds: 30,
    windowSteps: 1,
    digits: 6,
  },
  passwordReset: {
    // Accepted PASSWORD_AND_AUTHENTICATION_POLICY.md §4: code-owned ceiling.
    maxTtlMinutes: 15,
  },
  backupCodes: {
    count: 10,
    length: 8,
    hashCost: 10,
    alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  },
  contactVerification: {
    resendLimit: 3,
    resendWindowMinutes: 60,
    tokenRetentionDays: 7,
  },
} as const;
