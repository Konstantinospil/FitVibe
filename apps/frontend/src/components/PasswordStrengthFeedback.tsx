import { useTranslation } from "react-i18next";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary as commonDictionary } from "@zxcvbn-ts/language-common";
import { dictionary as englishDictionary, translations } from "@zxcvbn-ts/language-en";

// Reuse a deterministic, version-pinned local estimator; never submit passwords
// to an external strength-scoring endpoint.
const estimator = new ZxcvbnFactory({
  dictionary: { ...commonDictionary, ...englishDictionary },
  graphs: adjacencyGraphs,
  translations,
});

function estimatedStrength(password: string): number {
  // The UI shows four filled levels. zxcvbn-ts provides a 0–4 score.
  return Math.max(1, estimator.check(password).score);
}

/** Visual guidance only; breached-password, history and policy checks stay server-side. */
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

  const score = estimatedStrength(password);
  const level = ["", "veryWeak", "weak", "fair", "strong"][score];
  const advice =
    password.length < minimum
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
        data-score={score}
        className="password-strength-meter"
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            data-active={segment <= score ? "true" : "false"}
            className="password-strength-segment"
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
