// Text shared by the eager layout placeholder (PasswordStrengthFeedback) and
// the lazily loaded estimator (PasswordStrengthMeter). Keeping it in one place
// guarantees the placeholder reserves the same rows the meter renders.
import type { TFunction } from "i18next";

export const PASSWORD_STRENGTH_LEVELS = ["veryWeak", "weak", "fair", "strong"] as const;

export type PasswordStrengthLevel = (typeof PASSWORD_STRENGTH_LEVELS)[number];

export function passwordStrengthAdvice(t: TFunction, password: string, minimum: number): string {
  return password.length < minimum
    ? t("passwordStrength.tooShort", { minimum })
    : t("passwordStrength.minimumMet");
}
