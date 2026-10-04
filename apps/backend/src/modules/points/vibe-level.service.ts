import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import type { SessionWithExercises } from "../sessions/sessions.types.js";
import type {
  DomainCode,
  DomainImpact,
  DomainVibeLevel,
  ExerciseMetadata,
  VibeLevelUpdateResult,
} from "./points.types.js";
import {
  getAllDomainVibeLevels,
  getDomainVibeLevel,
  insertVibeLevelChange,
  lockVibeLevelsForUser,
  updateDomainVibeLevel,
} from "./vibe-level.repository.js";

// Constants
const INITIAL_VIBE_LEVEL = 1000.0;
const INITIAL_RD = 350.0;
const INITIAL_VOLATILITY = 0.06;
const VOLATILITY_ADAPTATION = 0.0833;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Aggregate session metrics from all exercises and sets
 */
interface SessionMetrics {
  totalWeightKg: number;
  totalDistanceM: number;
  totalReps: number;
  sessionDurationMin: number;
  averageRpe: number | null;
  maxRpe: number | null;
  exerciseTypes: string[];
}

function aggregateSessionMetrics(
  session: SessionWithExercises,
  exerciseMetadata: Map<string, ExerciseMetadata>,
): SessionMetrics {
  let totalWeightKg = 0;
  let totalDistanceM = 0;
  let totalReps = 0;
  const rpeValues: number[] = [];
  const exerciseTypes: string[] = [];

  const startTime = session.started_at ? new Date(session.started_at).getTime() : null;
  const endTime = session.completed_at ? new Date(session.completed_at).getTime() : null;
  let sessionDurationMin = 0;

  if (startTime && endTime) {
    sessionDurationMin = (endTime - startTime) / (1000 * 60);
  }

  for (const exercise of session.exercises ?? []) {
    const metadata = exercise.exercise_id ? exerciseMetadata.get(exercise.exercise_id) : undefined;
    const typeCode = metadata?.type_code;
    if (typeCode) {
      exerciseTypes.push(typeCode.toLowerCase());
    }

    if (exercise.actual?.rpe !== undefined && exercise.actual.rpe !== null) {
      rpeValues.push(Number(exercise.actual.rpe));
    }

    if (exercise.actual?.distance !== undefined && exercise.actual.distance !== null) {
      totalDistanceM += Number(exercise.actual.distance) * 1000;
    }

    if (exercise.actual?.load !== undefined && exercise.actual.load !== null) {
      const load = Number(exercise.actual.load);
      const reps = exercise.actual.reps ?? 1;
      totalWeightKg += load * reps;
    }

    for (const set of exercise.sets ?? []) {
      if (set.rpe !== undefined && set.rpe !== null) {
        rpeValues.push(Number(set.rpe));
      }

      if (set.weight_kg !== undefined && set.weight_kg !== null) {
        const weight = Number(set.weight_kg);
        const reps = set.reps ?? 1;
        totalWeightKg += weight * reps;
      }

      if (set.distance_m !== undefined && set.distance_m !== null) {
        totalDistanceM += Number(set.distance_m);
      }

      if (set.reps !== undefined && set.reps !== null) {
        totalReps += Number(set.reps);
      }
    }
  }

  const averageRpe =
    rpeValues.length > 0
      ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
      : null;
  const maxRpe = rpeValues.length > 0 ? Math.max(...rpeValues) : null;

  return {
    totalWeightKg,
    totalDistanceM,
    totalReps,
    sessionDurationMin,
    averageRpe,
    maxRpe,
    exerciseTypes,
  };
}

/**
 * Detect which domains a session trains based on metrics
 */
export function detectSessionDomains(
  session: SessionWithExercises,
  exerciseMetadata: Map<string, ExerciseMetadata>,
): DomainImpact[] {
  const metrics = aggregateSessionMetrics(session, exerciseMetadata);
  const impacts: DomainImpact[] = [];

  // 1. Strength Domain
  if (metrics.totalWeightKg > 0) {
    const impact = Math.min(1.0, metrics.totalWeightKg / 500);
    impacts.push({
      domain: "strength",
      impact,
      reason: `Lifted ${Math.round(metrics.totalWeightKg)}kg total`,
    });
  }

  // 2. Endurance Domain
  const distanceKm = metrics.totalDistanceM / 1000;
  const distanceScore = Math.min(1.0, distanceKm / 10); // 10km = max
  const durationScore = Math.min(1.0, metrics.sessionDurationMin / 60); // 60min = max

  if (metrics.totalDistanceM > 0 || metrics.sessionDurationMin > 20) {
    let enduranceScore: number;
    if (metrics.averageRpe !== null && metrics.averageRpe < 4 && metrics.sessionDurationMin > 20) {
      // Low intensity = more recovery than training
      enduranceScore = Math.max(distanceScore, durationScore * 0.3);
    } else {
      enduranceScore = Math.max(distanceScore, durationScore * 0.7);
    }

    if (enduranceScore > 0) {
      let reason: string;
      if (metrics.totalDistanceM > 0) {
        reason = `Covered ${distanceKm.toFixed(1)}km`;
      } else if (metrics.averageRpe !== null && metrics.averageRpe < 4) {
        reason = `Low intensity long duration (more recovery than training)`;
      } else {
        reason = `Trained for ${Math.round(metrics.sessionDurationMin)} minutes`;
      }

      impacts.push({
        domain: "endurance",
        impact: enduranceScore,
        reason,
      });
    }
  }

  // 3. Explosivity Domain
  if (metrics.maxRpe !== null && metrics.maxRpe >= 8 && metrics.sessionDurationMin < 30) {
    const explosivityScore = Math.min(1.0, (metrics.maxRpe - 7) / 3);
    impacts.push({
      domain: "explosivity",
      impact: explosivityScore,
      reason: `High intensity (RPE ${metrics.maxRpe}) short session`,
    });
  }

  // Alternative trigger: High power output
  const powerOutput = metrics.totalWeightKg * metrics.totalReps;
  if (powerOutput > 2000 && metrics.sessionDurationMin < 20) {
    const explosivityScore = Math.min(1.0, powerOutput / 5000);
    impacts.push({
      domain: "explosivity",
      impact: explosivityScore,
      reason: `High power output: ${Math.round(powerOutput)}kg×reps`,
    });
  }

  // 4. Agility Domain
  if (
    metrics.totalWeightKg === 0 &&
    metrics.totalReps > 0 &&
    metrics.averageRpe !== null &&
    metrics.averageRpe >= 5 &&
    metrics.averageRpe <= 8
  ) {
    const agilityScore = Math.min(1.0, metrics.totalReps / 200);
    impacts.push({
      domain: "agility",
      impact: agilityScore,
      reason: `${metrics.totalReps} bodyweight reps at moderate intensity`,
    });
  }

  // 5. Regeneration Domain
  const hasFlexibility = metrics.exerciseTypes.some((type) =>
    ["yoga", "pilates", "mobility"].includes(type),
  );
  if (hasFlexibility) {
    impacts.push({
      domain: "regeneration",
      impact: 0.9,
      reason: "Flexibility/mobility work",
    });
  }

  // Low intensity + long duration
  if (metrics.averageRpe !== null && metrics.averageRpe <= 5 && metrics.sessionDurationMin > 15) {
    const regenScore = Math.min(0.7, (6 - metrics.averageRpe) / 5);
    impacts.push({
      domain: "regeneration",
      impact: regenScore,
      reason: `Low intensity recovery (RPE ${metrics.averageRpe.toFixed(1)})`,
    });
  }

  // 6. Intelligence Domain
  const hasMental = metrics.exerciseTypes.some((type) => type === "skill");
  if (hasMental) {
    impacts.push({
      domain: "intelligence",
      impact: 0.8,
      reason: "Skill/mental training",
    });
  }

  // Catalog vibe type_codes credit the matching domain when metrics did not already.
  const vibeTypeCodes: DomainCode[] = [
    "strength",
    "agility",
    "endurance",
    "explosivity",
    "intelligence",
    "regeneration",
  ];
  const credited = new Set(impacts.map((impact) => impact.domain));
  for (const typeCode of new Set(metrics.exerciseTypes)) {
    if (!(vibeTypeCodes as string[]).includes(typeCode)) {
      continue;
    }
    const domain = typeCode as DomainCode;
    if (credited.has(domain)) {
      continue;
    }
    impacts.push({
      domain,
      impact: 0.85,
      reason: `Catalog vibe: ${domain}`,
    });
    credited.add(domain);
  }

  // Normalize: ensure at least one domain gets credit
  if (impacts.length === 0) {
    impacts.push({
      domain: "intelligence",
      impact: 0.5,
      reason: "Default domain (no specific metrics detected)",
    });
  }

  // Sort by impact (highest first)
  impacts.sort((a, b) => b.impact - a.impact);

  return impacts;
}

/**
 * Calculate performance score (0-100) for a domain based on session metrics
 */
export function calculatePerformanceScore(
  session: SessionWithExercises,
  domain: DomainCode,
  currentVibeLevel: number,
  exerciseMetadata: Map<string, ExerciseMetadata>,
): number {
  const metrics = aggregateSessionMetrics(session, exerciseMetadata);

  // Expected performance based on vibe level
  const expectedPerformance = 50 + (currentVibeLevel - 1000) / 20;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _expectedClamped = clamp(expectedPerformance, 30, 70); // Reserved for future use

  let actualPerformance: number;

  switch (domain) {
    case "strength": {
      const expectedWeight = Math.max(50, (currentVibeLevel - 1000) * 0.5);
      const actualWeight = metrics.totalWeightKg;
      const ratio = expectedWeight > 0 ? actualWeight / expectedWeight : 0;
      actualPerformance = 50 + (ratio - 1) * 50;
      break;
    }

    case "endurance": {
      const expectedDistance = Math.max(1, (currentVibeLevel - 1000) * 0.01); // km
      const actualDistance = metrics.totalDistanceM / 1000;
      const expectedTime = expectedDistance * 6; // 6 min/km baseline
      const actualTime = metrics.sessionDurationMin;

      if (actualDistance > 0) {
        const distanceRatio = actualDistance / expectedDistance;
        const timeRatio = actualTime > 0 ? expectedTime / actualTime : 1; // >1 if faster
        const combinedRatio = distanceRatio * (1 + (timeRatio - 1) * 0.3);
        actualPerformance = 50 + (combinedRatio - 1) * 50;
      } else if (actualTime > 0) {
        // Duration-based
        const timeRatio = expectedTime / actualTime;
        actualPerformance = 50 + (timeRatio - 1) * 30;
      } else {
        actualPerformance = 50;
      }
      break;
    }

    case "explosivity": {
      if (metrics.maxRpe !== null) {
        actualPerformance = metrics.maxRpe * 10;
      } else {
        actualPerformance = 50;
      }
      break;
    }

    case "agility": {
      const repsScore = Math.min(100, (metrics.totalReps / 200) * 100);
      const rpeScore = metrics.averageRpe !== null ? metrics.averageRpe * 10 : 50;
      actualPerformance = (repsScore + rpeScore) / 2;
      break;
    }

    case "regeneration": {
      if (metrics.averageRpe !== null) {
        const rpeScore = (6 - metrics.averageRpe) * 20; // Lower RPE = better for recovery
        const durationScore = Math.min(50, metrics.sessionDurationMin / 2);
        actualPerformance = rpeScore + durationScore;
      } else {
        actualPerformance = 50;
      }
      break;
    }

    case "intelligence": {
      // Generic: use duration and RPE
      const durationScore = Math.min(50, metrics.sessionDurationMin / 2);
      const rpeScore = metrics.averageRpe !== null ? metrics.averageRpe * 5 : 25;
      actualPerformance = durationScore + rpeScore;
      break;
    }

    default: {
      // Generic: use RPE and duration
      const avgRpe = metrics.averageRpe ?? 5;
      const duration = metrics.sessionDurationMin;
      actualPerformance = avgRpe * 10 + Math.min(30, duration / 2);
    }
  }

  return clamp(actualPerformance, 0, 100);
}

/**
 * Update the endogenous FitVibe uncertainty/volatility term.
 * This is a product-specific progression model, not a Glicko-2 implementation.
 */
function updateVolatility(
  currentVolatility: number,
  delta: number,
  phi: number,
  v: number,
  tau: number,
): number {
  // Bounded Newton-style adaptation used by the FitVibe progression model.
  const a = Math.log(currentVolatility ** 2);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const phi2 = phi ** 2;
    const v2 = v;
    const delta2 = delta ** 2;
    return (ex * (delta2 - phi2 - v2 - ex)) / (2 * (phi2 + v2 + ex) ** 2) - (x - a) / tau ** 2;
  };

  // Newton-Raphson iteration (simplified to 3 iterations)
  let x = a;
  for (let i = 0; i < 3; i++) {
    const fx = f(x);
    const fpx = (f(x + 0.0001) - fx) / 0.0001;
    if (Math.abs(fpx) < 0.0001) {
      break;
    }
    x = x - fx / fpx;
  }

  return Math.exp(x / 2);
}

/**
 * Update the endogenous FitVibe domain progression state from workout performance.
 * The inputs are workout-derived rather than opponent/match results; do not label this Glicko-2.
 */
export function updateVibeProgression(
  currentRating: number,
  currentRd: number,
  currentVolatility: number,
  outcome: number, // 0-1 (performance score / 100)
  domainImpact: number, // 0-1
): { newRating: number; newRd: number; newVolatility: number } {
  // Normalize the progression level and uncertainty to the model scale.
  const mu = (currentRating - 1500) / 173.7178;
  const phi = currentRd / 173.7178;

  // Step 2: Calculate g(φ) and E(μ, μj, φj)
  const g = 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
  const E = 1 / (1 + Math.exp(-g * mu));

  // Step 3: Compute v (variance of the prior distribution)
  const v = 1 / (g ** 2 * E * (1 - E));

  // Step 4: Compute Δ (change in rating)
  const delta = v * g * (outcome - E);

  // Step 5: Compute new volatility
  const newVolatility = updateVolatility(currentVolatility, delta, phi, v, VOLATILITY_ADAPTATION);

  // Step 6: Update φ' (new RD)
  const phiStar = Math.sqrt(phi ** 2 + newVolatility ** 2);
  const phiPrime = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);

  // Step 7: Update μ' (new rating)
  const muPrime = mu + phiPrime ** 2 * g * (outcome - E);

  // Step 8: Convert back to original scale
  const newRating = muPrime * 173.7178 + 1500;
  const newRd = phiPrime * 173.7178;

  // Step 9: Apply domain impact multiplier
  const ratingChange = (newRating - currentRating) * domainImpact;
  const finalRating = currentRating + ratingChange;

  // Clamp values
  return {
    newRating: clamp(finalRating, 100, 3000),
    newRd: clamp(newRd, 30, 350),
    newVolatility: clamp(newVolatility, 0.01, 0.1),
  };
}

/**
 * Calculate domain balance bonus (encourages balanced training)
 */
async function calculateDomainBalanceBonus(
  userId: string,
  domainCode: DomainCode,
  trx?: Knex.Transaction,
): Promise<number> {
  const allVibeLevels = await getAllDomainVibeLevels(userId, trx);
  const currentVibeLevel = allVibeLevels.get(domainCode)?.vibe_level ?? 1000;

  // Calculate average vibe level across all domains
  const levels = Array.from(allVibeLevels.values()).map((vl) => vl.vibe_level);
  if (levels.length === 0) {
    return 0;
  }

  const avgVibeLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;

  // If this domain is below average, give bonus
  if (currentVibeLevel < avgVibeLevel) {
    const deficit = avgVibeLevel - currentVibeLevel;
    return Math.min(30, deficit / 10); // Up to 30 bonus points
  }

  return 0;
}

/**
 * Calculate points from vibe level change
 */
export async function calculatePointsFromVibeLevel(
  vibeLevelChange: number,
  domainImpact: number,
  performanceScore: number,
  ratingDeviation: number,
  userId: string,
  domainCode: DomainCode,
  trx?: Knex.Transaction,
): Promise<number> {
  // Base points from vibe level gain
  const basePoints = vibeLevelChange * 2; // 1 vibe level point = 2 game points

  // Impact multiplier (how relevant was this session to the domain)
  const impactMultiplier = 0.5 + domainImpact * 0.5; // 0.5x to 1.0x

  // Performance multiplier (how well you performed)
  const performanceMultiplier = 0.7 + (performanceScore / 100) * 0.3; // 0.7x to 1.0x

  // RD modifier (lower RD = more reliable = slight bonus)
  const rdModifier = 1.0 - (ratingDeviation / 350) * 0.1; // Up to 10% bonus

  // Domain balance bonus (encourage training weak domains)
  const domainBalanceBonus = await calculateDomainBalanceBonus(userId, domainCode, trx);

  let points = basePoints * impactMultiplier * performanceMultiplier * rdModifier;
  points += domainBalanceBonus;

  return Math.round(clamp(points, 5, 200)); // Min 5, max 200 per domain
}

/**
 * Update domain vibe level for a session
 */
async function updateDomainVibeLevelForSessionInTransaction(
  userId: string,
  domain: DomainCode,
  session: SessionWithExercises,
  domainImpact: DomainImpact,
  exerciseMetadata: Map<string, ExerciseMetadata>,
  trx: Knex.Transaction,
): Promise<VibeLevelUpdateResult> {
  await lockVibeLevelsForUser(userId, trx);

  // Get current vibe level
  const current = await getDomainVibeLevel(userId, domain, trx);
  const currentRating = current?.vibe_level ?? INITIAL_VIBE_LEVEL;
  const currentRd = current?.rating_deviation ?? INITIAL_RD;
  const currentVolatility = current?.volatility ?? INITIAL_VOLATILITY;

  // Calculate performance score
  const performanceScore = calculatePerformanceScore(
    session,
    domain,
    currentRating,
    exerciseMetadata,
  );

  // Normalize workout performance to the endogenous progression outcome (0-1).
  const outcome = performanceScore / 100;

  // Update FitVibe progression state.
  const { newRating, newRd, newVolatility } = updateVibeProgression(
    currentRating,
    currentRd,
    currentVolatility,
    outcome,
    domainImpact.impact,
  );

  // Calculate points
  const vibeLevelChange = newRating - currentRating;
  const pointsAwarded = await calculatePointsFromVibeLevel(
    vibeLevelChange,
    domainImpact.impact,
    performanceScore,
    newRd,
    userId,
    domain,
    trx,
  );

  // Update database
  await updateDomainVibeLevel(
    userId,
    domain,
    newRating,
    newRd,
    newVolatility,
    trx,
    session.completed_at ?? undefined,
  );

  // Log change
  await insertVibeLevelChange(
    {
      user_id: userId,
      domain_code: domain,
      session_id: session.id,
      old_vibe_level: currentRating,
      new_vibe_level: newRating,
      old_rd: currentRd,
      new_rd: newRd,
      change_amount: vibeLevelChange,
      performance_score: performanceScore,
      domain_impact: domainImpact.impact,
      points_awarded: pointsAwarded,
      change_reason: "session_completed",
      metadata: {
        reason: domainImpact.reason,
      },
    },
    trx,
  );

  return {
    domain,
    oldVibeLevel: currentRating,
    newVibeLevel: newRating,
    oldRd: currentRd,
    newRd,
    oldVolatility: currentVolatility,
    newVolatility,
    performanceScore,
    domainImpact: domainImpact.impact,
    pointsAwarded,
  };
}

export async function updateDomainVibeLevelForSession(
  userId: string,
  domain: DomainCode,
  session: SessionWithExercises,
  domainImpact: DomainImpact,
  exerciseMetadata: Map<string, ExerciseMetadata>,
  trx?: Knex.Transaction,
): Promise<VibeLevelUpdateResult> {
  if (trx) {
    return updateDomainVibeLevelForSessionInTransaction(
      userId,
      domain,
      session,
      domainImpact,
      exerciseMetadata,
      trx,
    );
  }

  return db.transaction((transaction: Knex.Transaction) =>
    updateDomainVibeLevelForSessionInTransaction(
      userId,
      domain,
      session,
      domainImpact,
      exerciseMetadata,
      transaction,
    ),
  );
}

/**
 * Calculate general fitness score using geometric mean
 */
export function calculateGeneralFitnessScore(vibeLevels: Map<DomainCode, DomainVibeLevel>): number {
  const domains: DomainCode[] = [
    "strength",
    "agility",
    "endurance",
    "explosivity",
    "intelligence",
    "regeneration",
  ];

  // Get vibe level for each domain (default to 1000 if not set)
  const levels = domains.map((domain) => vibeLevels.get(domain)?.vibe_level ?? 1000);

  // Calculate product of all vibe levels
  const product = levels.reduce((acc, level) => acc * level, 1);

  // Geometric mean: nth root of product (n = 6 domains)
  const geometricMean = Math.pow(product, 1 / 6);

  // Round to 2 decimal places for display
  return Math.round(geometricMean * 100) / 100;
}
