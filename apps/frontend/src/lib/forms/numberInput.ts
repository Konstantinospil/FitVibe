/**
 * Value of an optional number field: null when blank, negative or not a number.
 * Shared by the workout forms so they treat empty and invalid input the same way.
 */
export const optionalNonNegativeNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
