import type { TFunction } from "i18next";
import type { SessionExerciseSet } from "../../services/sessionApi";

/**
 * Text for a set's values, shared by the session page and the live workout so a
 * target reads the same everywhere (ADR-042).
 */
type Translate = TFunction;

const SUMMARY_SEPARATOR = " · ";

export function metric(t: Translate, key: string, value: string | number | null | undefined) {
  return value === null || value === undefined ? null : t(`sessionDetail.${key}`, { value });
}

export const joinMetrics = (parts: Array<string | null>) =>
  parts.filter((part): part is string => Boolean(part)).join(SUMMARY_SEPARATOR);

type SetValues = Pick<
  SessionExerciseSet,
  "reps" | "weight_kg" | "duration_sec" | "distance_m" | "rpe" | "rest_sec"
>;

export function valuesSummary(t: Translate, values: Partial<SetValues> | null | undefined) {
  return joinMetrics([
    metric(t, "reps", values?.reps),
    metric(t, "load", values?.weight_kg),
    metric(t, "duration", values?.duration_sec),
    metric(t, "distance", values?.distance_m),
    metric(t, "rpe", values?.rpe),
    metric(t, "rest", values?.rest_sec),
  ]);
}

/** What was done for completed sets, the target for the rest (ADR-042). */
export function setSummary(t: Translate, set: SessionExerciseSet) {
  const target = valuesSummary(t, set.planned);
  if (set.status !== "completed") {
    return target || t("sessionDetail.unrecorded");
  }
  const performed = valuesSummary(t, set) || t("sessionDetail.unrecorded");
  return target ? `${performed} (${t("sessionDetail.target", { value: target })})` : performed;
}
