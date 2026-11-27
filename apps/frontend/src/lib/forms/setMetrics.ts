import type { SessionSetPlannedValues } from "../../services/sessionApi";
import { optionalNonNegativeNumber } from "./numberInput";

/**
 * The values an athlete records for one set, shared by the manual Log and the live
 * workout so both validate and send sets the same way (ADR-042).
 */
export type SetMetric = "reps" | "weight_kg" | "duration_sec" | "distance_m" | "rpe";

export type SetMetricInputs = Record<SetMetric, string>;

export type SetMetricValues = Pick<SessionSetPlannedValues, SetMetric>;

export interface SetMetricField {
  metric: SetMetric;
  /** i18n key of the field label. */
  labelKey: string;
  integer: boolean;
  min: number;
  max?: number;
}

/** Display order of the set fields. */
export const SET_METRIC_FIELDS: readonly SetMetricField[] = [
  { metric: "reps", labelKey: "workoutEditor.fields.repetitions", integer: true, min: 0 },
  { metric: "weight_kg", labelKey: "logSurface.fields.weight", integer: false, min: 0 },
  { metric: "duration_sec", labelKey: "workoutEditor.fields.duration", integer: true, min: 0 },
  { metric: "distance_m", labelKey: "logSurface.fields.distance", integer: true, min: 0 },
  { metric: "rpe", labelKey: "logSurface.fields.rpe", integer: true, min: 1, max: 10 },
];

export const EMPTY_SET_INPUTS: SetMetricInputs = {
  reps: "",
  weight_kg: "",
  duration_sec: "",
  distance_m: "",
  rpe: "",
};

export const fieldFor = (metric: SetMetric): SetMetricField =>
  SET_METRIC_FIELDS.find((field) => field.metric === metric)!;

export const isBlankSet = (inputs: SetMetricInputs, metrics = SET_METRIC_FIELDS) =>
  metrics.every(({ metric }) => !inputs[metric].trim());

/** The first filled field that is not a valid value, or null. Blank fields are allowed. */
export function invalidMetric(
  inputs: SetMetricInputs,
  metrics = SET_METRIC_FIELDS,
): SetMetric | null {
  for (const { metric, integer, min, max } of metrics) {
    if (!inputs[metric].trim()) {
      continue;
    }
    const value = optionalNonNegativeNumber(inputs[metric]);
    if (
      value === null ||
      (integer && !Number.isInteger(value)) ||
      value < min ||
      (max !== undefined && value > max)
    ) {
      return metric;
    }
  }
  return null;
}

/** Numbers to send; blank fields become null. */
export function toMetricValues(inputs: SetMetricInputs): SetMetricValues {
  return {
    reps: optionalNonNegativeNumber(inputs.reps),
    weight_kg: optionalNonNegativeNumber(inputs.weight_kg),
    duration_sec: optionalNonNegativeNumber(inputs.duration_sec),
    distance_m: optionalNonNegativeNumber(inputs.distance_m),
    rpe: optionalNonNegativeNumber(inputs.rpe),
  };
}

/** Inputs prefilled from values, such as a set's target. */
export function toMetricInputs(values: SetMetricValues | null | undefined): SetMetricInputs {
  const text = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  return {
    reps: text(values?.reps),
    weight_kg: text(values?.weight_kg),
    duration_sec: text(values?.duration_sec),
    distance_m: text(values?.distance_m),
    rpe: text(values?.rpe),
  };
}
