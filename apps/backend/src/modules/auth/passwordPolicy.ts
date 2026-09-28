import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import { HttpError } from "../../utils/http.js";

export interface PasswordContext {
  email?: string;
  username?: string;
  alias?: string;
}

const COMPLEXITY_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{${AUTH_SECURITY_POLICY.password.minLengthFloor},}import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import { HttpError } from "../../utils/http.js";

export interface PasswordContext {
  email?: string;
  username?: string;
  alias?: string;
}

,
);

export function assertPasswordPolicy(password: string, context?: PasswordContext) {
  const configuredMinLength = getRuntimeAppSetting<number>("auth.password_min_length");
  if (!COMPLEXITY_REGEX.test(password) || password.length < configuredMinLength) {
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

export const PASSWORD_COMPLEXITY_REGEX = COMPLEXITY_REGEX;
