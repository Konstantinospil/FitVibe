import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import type { IntakeKind, SessionIntake } from "../../services/sessionApi";

/** Order the kinds are offered and listed in (ADR-045). */
export const INTAKE_KINDS: readonly IntakeKind[] = ["water", "energy"];

/** Largest single entry of each kind; the server enforces the same limits. */
export const INTAKE_MAX_AMOUNT: Record<IntakeKind, number> = {
  water: TRAINING_DATA_CONFIG.intakeWaterMaxMl,
  energy: TRAINING_DATA_CONFIG.intakeEnergyMaxKcal,
};

/** A typed amount as a whole number within the kind's limit, or null when it is not one. */
export function parseIntakeAmount(kind: IntakeKind, text: string): number | null {
  const value = Number(text);
  return Number.isInteger(value) && value >= 1 && value <= INTAKE_MAX_AMOUNT[kind] ? value : null;
}

/** The total of one kind: millilitres of water or kilocalories of food energy. */
export const intakeTotal = (intake: SessionIntake, kind: IntakeKind) =>
  kind === "water" ? intake.totals.water_ml : intake.totals.energy_kcal;
