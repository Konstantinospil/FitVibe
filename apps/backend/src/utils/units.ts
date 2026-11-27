/** Exact by definition (international avoirdupois pound). The frontend uses the same value. */
export const KG_PER_LB = 0.45359237;

export const lbToKg = (pounds: number): number => pounds * KG_PER_LB;

export const kgToLb = (kilograms: number): number => kilograms / KG_PER_LB;

/** Body weight a profile accepts, in kilograms. The frontend offers the same range. */
export const BODY_WEIGHT_KG_LIMITS = { min: 20, max: 400 } as const;
