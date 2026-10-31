import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import { HttpError } from "../../utils/http.js";

export interface PasswordContext {
  email?: string;
  username?: string;
  alias?: string;
  role?: string;
}

export function passwordMinimumForRole(role?: string): number {
  return role === "admin" || role === "superadmin"
    ? 16
    : AUTH_SECURITY_POLICY.password.minLengthFloor;
}

export function assertPasswordPolicy(password: string, context?: PasswordContext) {
  const configuredMinLength = getRuntimeAppSetting<number>("auth.password_min_length");
  const minimum = Math.max(configuredMinLength, passwordMinimumForRole(context?.role));
  // Passphrases are accepted without prescribed character classes. Keep the
  // same explicit 128-character resource limit as the API schema.
  if (typeof password !== "string" || password.length < minimum || password.length > 128) {
    throw new HttpError(400, "WEAK_PASSWORD", "WEAK_PASSWORD");
  }

  const lowered = password.toLowerCase();
  const handle = context?.alias ?? context?.username;
  if (handle && lowered.includes(handle.toLowerCase())) {
    throw new HttpError(400, "PASSWORD_CONTAINS_USERNAME", "PASSWORD_CONTAINS_USERNAME");
  }
  if (context?.email) {
    const localPart = context.email.split("@")[0];
    if (localPart && lowered.includes(localPart.toLowerCase())) {
      throw new HttpError(400, "PASSWORD_CONTAINS_EMAIL", "PASSWORD_CONTAINS_EMAIL");
    }
  }
}
