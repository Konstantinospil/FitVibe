/** Exact by definition (international avoirdupois pound). The frontend uses the same value. */
export const KG_PER_LB = 0.45359237;

export const lbToKg = (pounds: number): number => pounds * KG_PER_LB;

export const kgToLb = (kilograms: number): number => kilograms / KG_PER_LB;
