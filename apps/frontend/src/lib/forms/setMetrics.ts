import { optionalNonNegativeNumber } from "./numberInput";
import { fromStoredKg, toStoredKg, type LoadUnit } from "../units/load";

/**
 * The values an athlete records for one set, shared by the manual Log and the live
 * workout so both validate and send sets the same way (ADR-042).
 */
export type SetMetric =
  "reps" | "weight_kg" | "duration_sec" | "distance_m" | "rpe" | "heart_rate_bpm";

/** Metrics a target can hold. Heart rate is a result only (issue 89). */
export type TargetMetric = Exclude<SetMetric, "heart_rate_bpm">;

/** The fields as typed. `weight_kg` holds load in the athlete's unit until sent. */
export type SetMetricInputs = Record<SetMetric, string>;

export type SetMetricValues = { [K in SetMetric]?: number | null };

export type TargetMetricValues = { [K in TargetMetric]?: number | null };

export interface SetMetricField {
  metric: SetMetric;
  /** i18n key of the field label. */
  labelKey: string;
  integer: boolean;
  min: number;
  max?: number;
  /** A result with no target (heart rate): offered on every set, never prefilled. */
  resultOnly?: boolean;
}

/** Display order of the set fields. */
export const SET_METRIC_FIELDS: readonly SetMetricField[] = [
  { metric: "reps", labelKey: "workoutEditor.fields.repetitions", integer: true, min: 0 },
  { metric: "weight_kg", labelKey: "logSurface.fields.weight", integer: false, min: 0 },
  { metric: "duration_sec", labelKey: "workoutEditor.fields.duration", integer: true, min: 0 },
  { metric: "distance_m", labelKey: "logSurface.fields.distance", integer: true, min: 0 },
  { metric: "rpe", labelKey: "logSurface.fields.rpe", integer: true, min: 1, max: 10 },
  {
    metric: "heart_rate_bpm",
    labelKey: "logSurface.fields.heartRate",
    integer: true,
    min: 20,
    max: 250,
    resultOnly: true,
  },
];

export const EMPTY_SET_INPUTS: SetMetricInputs = {
  reps: "",
  weight_kg: "",
  duration_sec: "",
  distance_m: "",
  rpe: "",
  heart_rate_bpm: "",
};

export const fieldFor = (metric: SetMetric): SetMetricField =>
  SET_METRIC_FIELDS.find((field) => field.metric === metric)!;

/** The field's label; load names the athlete's unit (issue 89). */
export const labelKeyFor = (field: SetMetricField, unit: LoadUnit): string =>
  field.metric === "weight_kg" && unit === "lb" ? "logSurface.fields.weightLb" : field.labelKey;

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

/** Numbers to send, load in kilograms; blank fields become null. */
export function toMetricValues(inputs: SetMetricInputs, unit: LoadUnit): SetMetricValues {
  const load = optionalNonNegativeNumber(inputs.weight_kg);
  return {
    reps: optionalNonNegativeNumber(inputs.reps),
    weight_kg: load === null ? null : toStoredKg(load, unit),
    duration_sec: optionalNonNegativeNumber(inputs.duration_sec),
    distance_m: optionalNonNegativeNumber(inputs.distance_m),
    rpe: optionalNonNegativeNumber(inputs.rpe),
    heart_rate_bpm: optionalNonNegativeNumber(inputs.heart_rate_bpm),
  };
}

/**
 * A set's stored values as a target, without converting units. Heart rate is left
 * out: a target never holds one.
 */
export function pickTargetValues(values: TargetMetricValues): Required<TargetMetricValues> {
  return {
    reps: values.reps ?? null,
    weight_kg: values.weight_kg ?? null,
    duration_sec: values.duration_sec ?? null,
    distance_m: values.distance_m ?? null,
    rpe: values.rpe ?? null,
  };
}

/** Inputs prefilled from values (load in kilograms), such as a set's target. */
export function toMetricInputs(
  values: SetMetricValues | null | undefined,
  unit: LoadUnit,
): SetMetricInputs {
  const text = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  const load = values?.weight_kg;
  return {
    reps: text(values?.reps),
    weight_kg: text(load === null || load === undefined ? load : fromStoredKg(load, unit)),
    duration_sec: text(values?.duration_sec),
    distance_m: text(values?.distance_m),
    rpe: text(values?.rpe),
    heart_rate_bpm: text(values?.heart_rate_bpm),
  };
}
