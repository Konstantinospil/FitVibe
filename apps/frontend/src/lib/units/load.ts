/**
 * Load is stored in kilograms (two decimals, `weight_kg`) and entered and shown in
 * the athlete's unit, from their metric/imperial preference (issue 89).
 */
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import { roundTo } from "../math/round";

export type MeasurementSystem = "metric" | "imperial";
export type LoadUnit = "kg" | "lb";

/** Exact by definition (international avoirdupois pound). */
export const KG_PER_LB = 0.45359237;

/** Kilograms are stored with two decimals (`weight_kg`, numeric(8,2)). */
const STORED_DECIMALS = 2;
/** Load shown in pounds, to one decimal. */
const SHOWN_LB_DECIMALS = 1;
/** Body weight is typed with up to two decimals (Settings). */
export const BODY_WEIGHT_INPUT_DECIMALS = 2;

export const loadUnitFor = (system: MeasurementSystem | null | undefined): LoadUnit =>
  system === "imperial" ? "lb" : "kg";

/** Kilograms as stored → the number to show or prefill in `unit`. */
export function fromStoredKg(kg: number, unit: LoadUnit): number {
  return unit === "lb" ? roundTo(kg / KG_PER_LB, SHOWN_LB_DECIMALS) : kg;
}

/** A value entered in `unit` → kilograms to store. */
export function toStoredKg(value: number, unit: LoadUnit): number {
  return unit === "lb" ? roundTo(value * KG_PER_LB, STORED_DECIMALS) : value;
}

/** Body weight accepted by the profile, in kilograms (the backend checks the same range). */
export const BODY_WEIGHT_KG_LIMITS = {
  min: TRAINING_DATA_CONFIG.bodyWeightMinKg,
  max: TRAINING_DATA_CONFIG.bodyWeightMaxKg,
} as const;

/**
 * The body-weight range to offer in `unit`, rounded inwards to the input's two
 * decimals so both ends convert back inside the kilogram range.
 */
export function bodyWeightBounds(unit: LoadUnit): { min: number; max: number } {
  if (unit === "kg") {
    return { ...BODY_WEIGHT_KG_LIMITS };
  }
  return {
    min: roundTo(BODY_WEIGHT_KG_LIMITS.min / KG_PER_LB, BODY_WEIGHT_INPUT_DECIMALS, "up"),
    max: roundTo(BODY_WEIGHT_KG_LIMITS.max / KG_PER_LB, BODY_WEIGHT_INPUT_DECIMALS, "down"),
  };
}
