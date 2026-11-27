/**
 * Account bounds the server enforces (AUTH_SECURITY_POLICY in
 * apps/backend/src/config/security-policy.ts). Checked here first so a wrong
 * value is explained before it is sent; a contract test keeps both in step.
 */
export const ACCOUNT_LIMITS = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  usernameMinLength: 3,
  usernameMaxLength: 50,
  minAgeYears: 13,
  maxAgeYears: 120,
} as const;
