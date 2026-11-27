export type RoundingMode = "nearest" | "up" | "down";

const ROUND: Record<RoundingMode, (value: number) => number> = {
  nearest: Math.round,
  up: Math.ceil,
  down: Math.floor,
};

/** `value` rounded to `decimals` places; "up" and "down" round towards ±infinity. */
export function roundTo(value: number, decimals: number, mode: RoundingMode = "nearest"): number {
  const factor = 10 ** decimals;
  return ROUND[mode](value * factor) / factor;
}
