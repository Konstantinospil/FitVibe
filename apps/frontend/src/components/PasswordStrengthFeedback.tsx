import { lazy, Suspense } from "react";

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
  if (!password) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <PasswordStrengthMeter password={password} minimum={minimum} />
    </Suspense>
  );
}
