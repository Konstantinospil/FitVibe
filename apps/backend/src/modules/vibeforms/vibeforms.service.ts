import { UpdateVibeformPreferencesSchema } from "./vibeforms.schemas.js";
import { getLatestBioValuesByKeys } from "../measurements/measurements.repository.js";
import { getAllDomainVibeLevels } from "../points/vibe-level.repository.js";
import { ensureGamificationProjectionFresh } from "../points/gamification-projection.service.js";
import type { DomainCode } from "../points/points.types.js";
import {
  listRegionalStrengthStimuli,
  type RegionalStrengthStimulus,
} from "../sessions/sessions.repository.js";
import {
  DEFAULT_VIBEFORM_PREFERENCES,
  VIBEFORM_BODY_PROFILES,
  VIBEFORM_TEMPLATE_VERSIONS,
  type UpdateVibeformPreferencesInput,
  type VibeformBodyProfile,
  type VibeformPreferenceRow,
  type VibeformPreferences,
  type VibeformMetrics,
  type VibeformProfile,
  type VibeformTemplateCode,
} from "./vibeforms.types.js";
import { findVibeformPreferences, upsertVibeformPreferences } from "./vibeforms.repository.js";

export const VIBEFORM_CALCULATION_VERSION = "2";
export const VIBEFORM_TRAINING_WINDOW_WEEKS = 12;
export const VIBEFORM_REGIONAL_LOAD_TARGET = 72;
export const VIBEFORM_RECENCY_HALF_LIFE_DAYS = 42;

const MIN_VIBE_LEVEL = 100;
const MAX_VIBE_LEVEL = 3000;
const INITIAL_VIBE_LEVEL = 1000;
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeVibeLevel(level: number): number {
  return clamp01((level - MIN_VIBE_LEVEL) / (MAX_VIBE_LEVEL - MIN_VIBE_LEVEL));
}

function normalizeRegionalLoad(load: number): number {
  return clamp01(load / VIBEFORM_REGIONAL_LOAD_TARGET);
}

/**
 * Effective load is unit-neutral: completed strength sets are adjusted by
 * reported RPE and exponentially decayed with a six-week half-life.
 */
function effectiveRegionalLoads(
  stimuli: RegionalStrengthStimulus[],
  calculatedAt: Date,
): { upper: number; lower: number; fullBody: number } {
  const loads = { upper: 0, lower: 0, fullBody: 0 };
  for (const stimulus of stimuli) {
    const ageDays = Math.max(
      0,
      (calculatedAt.getTime() - new Date(stimulus.completedAt).getTime()) / MILLISECONDS_PER_DAY,
    );
    const recencyMultiplier = 2 ** (-ageDays / VIBEFORM_RECENCY_HALF_LIFE_DAYS);
    const intensityMultiplier =
      stimulus.averageRpe === null ? 1 : 0.5 + 0.5 * clamp01(stimulus.averageRpe / 10);
    loads[stimulus.region] += stimulus.setCount * intensityMultiplier * recencyMultiplier;
  }
  return loads;
}

function calculateBmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / heightM ** 2) * 100) / 100;
}

function getNormalizedDomainLevel(
  levels: Awaited<ReturnType<typeof getAllDomainVibeLevels>>,
  domain: DomainCode,
): number {
  return normalizeVibeLevel(levels.get(domain)?.vibe_level ?? INITIAL_VIBE_LEVEL);
}

function isTemplateCode(value: string): value is VibeformTemplateCode {
  return Object.hasOwn(VIBEFORM_TEMPLATE_VERSIONS, value);
}

function isBodyProfile(value: string): value is VibeformBodyProfile {
  return (VIBEFORM_BODY_PROFILES as readonly string[]).includes(value);
}

function toPreferences(row: VibeformPreferenceRow): VibeformPreferences {
  if (!isTemplateCode(row.template_code) || !isBodyProfile(row.body_profile)) {
    throw new Error("Stored Vibeform preferences violate the application contract");
  }

  return {
    templateCode: row.template_code,
    templateVersion: row.template_version,
    bodyProfile: row.body_profile,
    motionEnabled: row.motion_enabled,
  };
}

export async function getVibeformPreferences(userId: string): Promise<VibeformPreferences> {
  const row = await findVibeformPreferences(userId);
  return row ? toPreferences(row) : { ...DEFAULT_VIBEFORM_PREFERENCES };
}

export async function updateVibeformPreferences(
  userId: string,
  input: UpdateVibeformPreferencesInput,
): Promise<VibeformPreferences> {
  const update = UpdateVibeformPreferencesSchema.parse(input);
  const current = await getVibeformPreferences(userId);
  const templateCode = update.templateCode ?? current.templateCode;
  const next: VibeformPreferences = {
    templateCode,
    templateVersion: VIBEFORM_TEMPLATE_VERSIONS[templateCode],
    bodyProfile: update.bodyProfile ?? current.bodyProfile,
    motionEnabled: update.motionEnabled ?? current.motionEnabled,
  };
  return toPreferences(await upsertVibeformPreferences(userId, next));
}

export async function getVibeformProfile(
  userId: string,
  now: Date = new Date(),
): Promise<VibeformProfile> {
  await ensureGamificationProjectionFresh(userId);
  const to = new Date(now);
  const from = new Date(to.getTime() - VIBEFORM_TRAINING_WINDOW_WEEKS * MILLISECONDS_PER_WEEK);

  const [preferences, bioValues, domainLevels, regionalStimuli] = await Promise.all([
    getVibeformPreferences(userId),
    getLatestBioValuesByKeys(userId, ["weight_kg", "height_cm"] as const),
    getAllDomainVibeLevels(userId),
    listRegionalStrengthStimuli(userId, { from, to }),
  ]);

  const measuredHeight = bioValues.height_cm?.valueNumber;
  const heightCm =
    typeof measuredHeight === "number" && Number.isFinite(measuredHeight) && measuredHeight > 0
      ? measuredHeight
      : null;
  const regionalLoad = effectiveRegionalLoads(regionalStimuli, to);
  const fullBodyShare = regionalLoad.fullBody / 2;
  const metrics: VibeformMetrics = {
    intelligence: getNormalizedDomainLevel(domainLevels, "intelligence"),
    regeneration: getNormalizedDomainLevel(domainLevels, "regeneration"),
    agility: getNormalizedDomainLevel(domainLevels, "agility"),
    explosivity: getNormalizedDomainLevel(domainLevels, "explosivity"),
    endurance: getNormalizedDomainLevel(domainLevels, "endurance"),
    strength: getNormalizedDomainLevel(domainLevels, "strength"),
    upperBodyLoad: normalizeRegionalLoad(regionalLoad.upper + fullBodyShare),
    lowerBodyLoad: normalizeRegionalLoad(regionalLoad.lower + fullBodyShare),
    bmi: calculateBmi(bioValues.weight_kg?.valueNumber, heightCm ?? undefined),
    heightCm,
  };

  return {
    preferences,
    metrics,
    calculationVersion: VIBEFORM_CALCULATION_VERSION,
    calculatedAt: to.toISOString(),
  };
}
