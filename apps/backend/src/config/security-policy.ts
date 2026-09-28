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
    hashCost: 12,
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
  backupCodes: {
    count: 10,
    length: 8,
    hashCost: 10,
    alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  },
} as const;
