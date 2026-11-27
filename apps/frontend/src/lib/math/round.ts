export type RoundingMode = "nearest" | "up" | "down";

/** Decimal places count powers of ten. */
const DECIMAL_BASE = 10;

const ROUND: Record<RoundingMode, (value: number) => number> = {
  nearest: Math.round,
  up: Math.ceil,
  down: Math.floor,
};

/** `value` rounded to `decimals` places; "up" and "down" round towards ±infinity. */
export function roundTo(value: number, decimals: number, mode: RoundingMode = "nearest"): number {
  const factor = DECIMAL_BASE ** decimals;
  return ROUND[mode](value * factor) / factor;
}
