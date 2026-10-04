import { v4 as uuidv4 } from "uuid";

import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import { HttpError } from "../../utils/http.js";
import { incrementPointsAwarded } from "../../observability/metrics.js";
import { pointsJobsService } from "../../jobs/services/points-jobs.service.js";
import {
  findPointsEventBySource,
  getExercisesMetadata,
  getPointsBalance,
  getPointsHistory as fetchPointsHistory,
  getRecentPointsEvents,
  insertPointsEvent,
  lockPointsSource,
  type HistoryCursor,
  type PointsHistoryOptions,
} from "./points.repository.js";
import type {
  AwardPointsResult,
  PointsEventRecord,
  PointsHistoryQuery,
  PointsHistoryResult,
  PointsSummary,
  SessionMetricsSnapshot,
} from "./points.types.js";
import type { SessionWithExercises } from "../sessions/sessions.types.js";
import { updateSession } from "../sessions/sessions.repository.js";
import { evaluateBadgesForSession } from "./badges.service.js";
import { detectSessionDomains, updateDomainVibeLevelForSession } from "./vibe-level.service.js";

export const POINTS_ALGORITHM_VERSION = "v2_vibe_lvl";
const DEFAULT_RECENT_LIMIT = 10;
const MAX_HISTORY_LIMIT = 100;

function decodeCursor(cursor: string): HistoryCursor {
  const [timestamp, id] = cursor.split("|");
  const date = new Date(timestamp);
  if (!id || Number.isNaN(date.getTime())) {
    throw new HttpError(400, "E.POINTS.INVALID_CURSOR", "POINTS_INVALID_CURSOR");
  }
  return { awardedAt: date, id };
}

function encodeCursor(event: PointsEventRecord): string {
  return `${event.awarded_at}|${event.id}`;
}

function computeSessionMetrics(
  session: SessionWithExercises,
  exerciseMetadata: Map<string, { tags: string[]; type_code: string | null }>,
): SessionMetricsSnapshot {
  const rpeValues: number[] = [];
  let totalDistanceMeters = 0;
  let runDistanceMeters = 0;
  let rideDistanceMeters = 0;
  let rowDistanceMeters = 0;

  for (const exercise of session.exercises ?? []) {
    if (exercise.actual?.rpe !== undefined && exercise.actual?.rpe !== null) {
      rpeValues.push(Number(exercise.actual.rpe));
    }
    const metadata = exercise.exercise_id ? exerciseMetadata.get(exercise.exercise_id) : undefined;
    const tags = metadata?.tags ?? [];
    const isRun = tags.some((tag) => tag.toLowerCase().includes("run"));
    const isRide =
      tags.some(
        (tag) => tag.toLowerCase().includes("ride") || tag.toLowerCase().includes("cycle"),
      ) || (metadata?.type_code ?? "").toLowerCase() === "cycling";
    const isRow = tags.some((tag) => tag.toLowerCase().includes("row"));

    if (exercise.actual?.distance !== undefined && exercise.actual.distance !== null) {
      const meters = Number(exercise.actual.distance) * 1000;
      totalDistanceMeters += meters;
      if (isRun) {
        runDistanceMeters += meters;
      }
      if (isRide) {
        rideDistanceMeters += meters;
      }
      if (isRow) {
        rowDistanceMeters += meters;
      }
    }

    for (const set of exercise.sets ?? []) {
      if (set.rpe !== undefined && set.rpe !== null) {
        rpeValues.push(Number(set.rpe));
      }
      if (set.distance_m !== undefined && set.distance_m !== null) {
        const meters = Number(set.distance_m);
        totalDistanceMeters += meters;
        if (isRun) {
          runDistanceMeters += meters;
        }
        if (isRide) {
          rideDistanceMeters += meters;
        }
        if (isRow) {
          rowDistanceMeters += meters;
        }
      }
    }
  }

  let averageRpe: number | null = null;
  if (rpeValues.length > 0) {
    averageRpe = rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length;
  }

  return {
    averageRpe,
    distanceMeters: totalDistanceMeters,
    runDistanceMeters,
    rideDistanceMeters,
    rowDistanceMeters,
  };
}

export async function getPointsSummary(userId: string): Promise<PointsSummary> {
  const [balance, recent] = await Promise.all([
    getPointsBalance(userId),
    getRecentPointsEvents(userId, DEFAULT_RECENT_LIMIT),
  ]);

  return {
    balance,
    recent,
  };
}

export async function getPointsHistory(
  userId: string,
  query: PointsHistoryQuery,
): Promise<PointsHistoryResult> {
  const limitInput = query.limit ?? 25;
  if (!Number.isInteger(limitInput) || limitInput < 1) {
    throw new HttpError(400, "E.POINTS.INVALID_LIMIT", "POINTS_INVALID_LIMIT");
  }
  const limit = Math.min(limitInput, MAX_HISTORY_LIMIT);

  const options: PointsHistoryOptions = {
    limit: limit + 1,
  };

  if (query.cursor) {
    options.cursor = decodeCursor(query.cursor);
  }

  if (query.from) {
    const fromDate = new Date(query.from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new HttpError(400, "E.POINTS.INVALID_FROM", "POINTS_INVALID_FROM");
    }
    options.from = fromDate;
  }
  if (query.to) {
    const toDate = new Date(query.to);
    if (Number.isNaN(toDate.getTime())) {
      throw new HttpError(400, "E.POINTS.INVALID_TO", "POINTS_INVALID_TO");
    }
    options.to = toDate;
  }

  const rows = await fetchPointsHistory(userId, options);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;

  return {
    items,
    nextCursor,
  };
}

function ensureCompleted(session: SessionWithExercises) {
  if (session.status !== "completed") {
    throw new HttpError(400, "E.POINTS.SESSION_NOT_COMPLETED", "POINTS_SESSION_NOT_COMPLETED");
  }
  if (!session.completed_at) {
    throw new HttpError(
      400,
      "E.POINTS.MISSING_COMPLETED_AT",
      "Completed session is missing completed_at timestamp.",
    );
  }
}

export interface AwardPointsOptions {
  trx?: Knex.Transaction;
  scheduleSecondary?: boolean;
  emitMetrics?: boolean;
}

async function awardPointsForSessionInTransaction(
  session: SessionWithExercises,
  trx: Knex.Transaction,
): Promise<AwardPointsResult> {
  await lockPointsSource(session.owner_id, session.id, trx);

  const existing = await findPointsEventBySource(
    session.owner_id,
    "session_completed",
    session.id,
    trx,
  );
  if (existing) {
    if (!session.points || session.points !== existing.points) {
      await updateSession(session.id, session.owner_id, { points: existing.points }, trx);
    }
    return {
      awarded: false,
      pointsAwarded: existing.points,
      eventId: existing.id,
      badgesAwarded: [],
    };
  }

  const exerciseMetadata = await getExercisesMetadata(
    session.exercises
      ?.map((exercise) => exercise.exercise_id)
      .filter((id): id is string => Boolean(id)) ?? [],
    trx,
  );

  const domainImpacts = detectSessionDomains(session, exerciseMetadata);

  let totalPoints = 0;
  const vibeLevelUpdates: Array<{
    domain: string;
    oldLevel: number;
    newLevel: number;
    points: number;
  }> = [];

  for (const domainImpact of domainImpacts) {
    const updateResult = await updateDomainVibeLevelForSession(
      session.owner_id,
      domainImpact.domain,
      session,
      domainImpact,
      exerciseMetadata,
      trx,
    );

    totalPoints += updateResult.pointsAwarded;
    vibeLevelUpdates.push({
      domain: domainImpact.domain,
      oldLevel: updateResult.oldVibeLevel,
      newLevel: updateResult.newVibeLevel,
      points: updateResult.pointsAwarded,
    });
  }

  totalPoints = Math.min(Math.max(totalPoints, 5), 500);

  const metrics = computeSessionMetrics(session, exerciseMetadata);

  const awardedAt = new Date(session.completed_at!);
  const createdAt = new Date();

  const event = await insertPointsEvent(
    {
      id: uuidv4(),
      user_id: session.owner_id,
      source_type: "session_completed",
      source_id: session.id,
      algorithm_version: POINTS_ALGORITHM_VERSION,
      points: totalPoints,
      calories: session.calories ?? null,
      metadata: {
        session_id: session.id,
        session_title: session.title ?? null,
        algorithm: POINTS_ALGORITHM_VERSION,
        domain_impacts: domainImpacts.map((di) => ({
          domain: di.domain,
          impact: di.impact,
          reason: di.reason,
        })),
        vibe_level_updates: vibeLevelUpdates,
        activity_breakdown: {
          distance_m: metrics.distanceMeters,
          run_distance_m: metrics.runDistanceMeters,
          ride_distance_m: metrics.rideDistanceMeters,
        },
      },
      awarded_at: awardedAt,
      created_at: createdAt,
    },
    trx,
  );

  await updateSession(session.id, session.owner_id, { points: totalPoints }, trx);

  const badgeResults = await evaluateBadgesForSession({
    session,
    metrics,
    trx,
  });

  for (const badge of badgeResults) {
    logger.info(
      {
        userId: session.owner_id,
        sessionId: session.id,
        badgeCode: badge.badgeCode,
      },
      "[points] Awarded badge",
    );
  }

  logger.info(
    {
      userId: session.owner_id,
      sessionId: session.id,
      points: totalPoints,
      domains: domainImpacts.map((di) => di.domain),
    },
    "[points] Calculated session gamification (v2_vibe_lvl)",
  );

  return {
    awarded: true,
    pointsAwarded: totalPoints,
    eventId: event.id,
    badgesAwarded: badgeResults.map((badge) => badge.badgeCode),
  };
}

export async function awardPointsForSession(
  session: SessionWithExercises,
  options: AwardPointsOptions = {},
): Promise<AwardPointsResult> {
  ensureCompleted(session);

  const result = options.trx
    ? await awardPointsForSessionInTransaction(session, options.trx)
    : await db.transaction((trx: Knex.Transaction) =>
        awardPointsForSessionInTransaction(session, trx),
      );

  if (result.awarded && options.emitMetrics !== false && result.pointsAwarded !== null) {
    incrementPointsAwarded("session_completed", result.pointsAwarded);
  }

  if (result.awarded && options.scheduleSecondary !== false && session.completed_at) {
    pointsJobsService.scheduleStreakEvaluation(session.owner_id, session.id, session.completed_at);
    pointsJobsService.scheduleSeasonalEventSweep(
      session.owner_id,
      session.id,
      session.completed_at,
    );
  }

  return result;
}
