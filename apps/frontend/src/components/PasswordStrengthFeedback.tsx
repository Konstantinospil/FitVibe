import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { PASSWORD_STRENGTH_LEVELS, passwordStrengthAdvice } from "./passwordStrengthText";

// The estimator's dictionaries are large. Load them only after the user enters
// a password; empty fields never need strength scoring during initial paint.
const PasswordStrengthMeter = lazy(() => import("./PasswordStrengthMeter"));

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

  const advice = passwordStrengthAdvice(t, password, minimum);
  const longestLevel = PASSWORD_STRENGTH_LEVELS.map((level) =>
    t(`passwordStrength.levels.${level}`),
  ).reduce((longest, label) => (label.length > longest.length ? label : longest));

  // The meter and an invisible copy of its rows share one grid cell. The copy
  // renders in the same commit as the keystroke, so the space is reserved
  // before the estimator chunk loads; when the meter arrives it fills that
  // space instead of pushing the fields below it down (issue 634: the shift
  // moved the registration legal checkboxes by 88 px mid-click). Using the
  // longest level label means level changes while typing cannot grow it either.
  // The copy's text is CSS-generated, aria-hidden and invisible.
  return (
    <div className="password-strength-slot" data-testid="password-strength-slot">
      <div aria-hidden="true" className="password-strength-slot__sizer grid grid--gap-xs">
        <div className="password-strength-slot__bar" />
        <p className="text-sm" data-sizer-text={`${longestLevel} — ${advice}`} />
        <p className="text-sm" data-sizer-text={t("passwordStrength.serverChecks")} />
      </div>
      <Suspense fallback={null}>
        <PasswordStrengthMeter password={password} minimum={minimum} />
      </Suspense>
    </div>
  );
}
