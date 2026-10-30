import { useTranslation } from "react-i18next";

/**
 * Passphrase guidance is informational, never a substitute for server-side
 * breached-password and password-history checks. No character-class rules.
 */
export function PasswordStrengthFeedback({
  password,
  minimum = 12,
}: {
  password: string;
  minimum?: number;
}) {
  const { t } = useTranslation();
  if (!password) {
    return null;
  }
  const words = password.trim().split(/\s+/u).filter(Boolean).length;
  const key =
    password.length < minimum
      ? "tooShort"
      : password.length >= 20 && words >= 3
        ? "longPassphrase"
        : "minimumMet";

  return (
    <p className="text-sm text-secondary" role="status" aria-live="polite" data-component="password-strength">
      {t(`passwordStrength.${key}`, { minimum })}
    </p>
  );
}
