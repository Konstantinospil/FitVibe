/**
 * Load is stored in kilograms (two decimals, `weight_kg`) and entered and shown in
 * the athlete's unit, from their metric/imperial preference (issue 89).
 */
export type MeasurementSystem = "metric" | "imperial";
export type LoadUnit = "kg" | "lb";

/** Exact by definition (international avoirdupois pound). */
export const KG_PER_LB = 0.45359237;

const STORED_DECIMALS = 2;
const SHOWN_LB_DECIMALS = 1;

export const loadUnitFor = (system: MeasurementSystem | null | undefined): LoadUnit =>
  system === "imperial" ? "lb" : "kg";

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Kilograms as stored → the number to show or prefill in `unit`. */
export function fromStoredKg(kg: number, unit: LoadUnit): number {
  return unit === "lb" ? round(kg / KG_PER_LB, SHOWN_LB_DECIMALS) : kg;
}

/** A value entered in `unit` → kilograms to store. */
export function toStoredKg(value: number, unit: LoadUnit): number {
  return unit === "lb" ? round(value * KG_PER_LB, STORED_DECIMALS) : value;
}
