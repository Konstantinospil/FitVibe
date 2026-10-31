import { useTranslation } from "react-i18next";

const COMMON_PATTERNS = /^(?:password|passwort|qwerty|welcome|admin|letmein|123456|abcdef)/iu;
const REPEATED = /^(.)\1+$/u;

function estimatedStrength(password: string): number {
  if (!password) return 0;
  if (COMMON_PATTERNS.test(password) || REPEATED.test(password)) return 1;
  // Heuristic guidance only: never implies that the server has approved the password.
  const lengthScore = password.length < 12 ? 1 : password.length < 16 ? 2 : password.length < 20 ? 3 : 4;
  const sequential = /(?:1234|abcd|qwer|asdf)/iu.test(password);
  const repeats = /(.)\1{3,}/u.test(password);
  return Math.max(1, lengthScore - Number(sequential || repeats));
}

const BAR_COLORS = [
  "var(--color-danger)",
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-accent)",
  "var(--color-success)",
] as const;

/** Visual guidance only; breached-password, history and policy checks stay server-side. */
export function PasswordStrengthFeedback({
  password,
  minimum = 12,
}: {
  password: string;
  minimum?: number;
}) {
  const { t } = useTranslation();
  if (!password) return null;

  const score = estimatedStrength(password);
  const level = ["", "veryWeak", "weak", "fair", "strong"][score];
  const advice = password.length < minimum
    ? t("passwordStrength.tooShort", { minimum })
    : t("passwordStrength.minimumMet");

  return (
    <div data-component="password-strength" className="grid grid--gap-xs">
      <div
        role="meter"
        aria-label={t("passwordStrength.meterLabel")}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={t(`passwordStrength.levels.${level}`)}
        className="flex flex--gap-xs"
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            style={{
              flex: 1,
              height: "var(--space-xs)",
              borderRadius: "var(--radius-md)",
              backgroundColor: segment <= score ? BAR_COLORS[score] : "var(--color-border)",
            }}
          />
        ))}
      </div>
      <p className="text-sm text-secondary" role="status" aria-live="polite">
        {t(`passwordStrength.levels.${level}`)} — {advice}
      </p>
      <p className="text-sm text-muted">{t("passwordStrength.serverChecks")}</p>
    </div>
  );
}
