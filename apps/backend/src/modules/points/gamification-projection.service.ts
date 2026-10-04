import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import { pointsJobsService } from "../../jobs/services/points-jobs.service.js";
import { applyVibeLevelDecayForUser } from "../../jobs/services/vibe-level-decay.service.js";
import {
  clearCompletedSessionGamificationRebuildFlags,
  getSessionWithDetails,
  listCompletedSessionIdsForGamification,
} from "../sessions/sessions.repository.js";
import { evaluateSeasonalEvents } from "./seasonal-events.service.js";
import { evaluateStreakBonus } from "./streaks.service.js";
import {
  archiveAndDeleteDerivedPoints,
  getGamificationProjectionState,
  lockGamificationProjectionForUser,
  markGamificationProjectionFresh,
  markGamificationProjectionStale,
  supersedeSessionDerivedGamification,
} from "./points.repository.js";
import { awardPointsForSession, POINTS_ALGORITHM_VERSION } from "./points.service.js";

export interface ReconcileGamificationOptions {
  sessionId?: string;
  forceFullRebuild?: boolean;
  reason?: string;
}

export async function markGamificationStale(
  userId: string,
  rebuildRequired: boolean,
  trx?: Knex.Transaction,
): Promise<void> {
  await markGamificationProjectionStale(userId, rebuildRequired, trx);
}

export function scheduleGamificationReconciliation(
  userId: string,
  sessionId?: string,
  forceFullRebuild = false,
): void {
  pointsJobsService.scheduleProjectionReconciliation(userId, sessionId, forceFullRebuild);
}

async function replayAllCompletedSessions(
  userId: string,
  reason: string,
  trx: Knex.Transaction,
): Promise<number> {
  await archiveAndDeleteDerivedPoints(userId, reason, trx);
  await supersedeSessionDerivedGamification(userId, trx);

  const sessionIds = await listCompletedSessionIdsForGamification(userId, trx);
  for (const sessionId of sessionIds) {
    const session = await getSessionWithDetails(sessionId, userId, {}, trx);
    if (!session || session.status !== "completed" || !session.completed_at) {
      continue;
    }

    await awardPointsForSession(session, {
      trx,
      scheduleSecondary: false,
      emitMetrics: false,
    });
    await evaluateStreakBonus(userId, session.id, session.completed_at, trx);
    await evaluateSeasonalEvents(userId, session.id, session.completed_at, trx);
  }

  await clearCompletedSessionGamificationRebuildFlags(userId, trx);
  return sessionIds.length;
}

async function reconcileOneCompletedSession(
  userId: string,
  sessionId: string,
  trx: Knex.Transaction,
): Promise<boolean> {
  const session = await getSessionWithDetails(sessionId, userId, {}, trx);
  if (!session || session.status !== "completed" || !session.completed_at) {
    return false;
  }

  await awardPointsForSession(session, {
    trx,
    scheduleSecondary: false,
    emitMetrics: false,
  });
  await evaluateStreakBonus(userId, session.id, session.completed_at, trx);
  await evaluateSeasonalEvents(userId, session.id, session.completed_at, trx);
  return true;
}

export async function reconcileGamificationProjection(
  userId: string,
  options: ReconcileGamificationOptions = {},
): Promise<{ rebuilt: boolean; sessionsProcessed: number }> {
  const result = await db.transaction(async (trx: Knex.Transaction) => {
    await lockGamificationProjectionForUser(userId, trx);

    const state = await getGamificationProjectionState(userId, trx);
    const fullRebuild =
      options.forceFullRebuild === true ||
      state === null ||
      state.rebuildRequired ||
      state.algorithmVersion !== POINTS_ALGORITHM_VERSION;

    if (state && !state.isStale && !fullRebuild) {
      return { rebuilt: false, sessionsProcessed: 0 };
    }

    let sessionsProcessed = 0;
    if (fullRebuild) {
      sessionsProcessed = await replayAllCompletedSessions(
        userId,
        options.reason ?? "gamification_projection_rebuild",
        trx,
      );
    } else if (options.sessionId) {
      sessionsProcessed = (await reconcileOneCompletedSession(userId, options.sessionId, trx))
        ? 1
        : 0;
    } else {
      sessionsProcessed = await replayAllCompletedSessions(
        userId,
        options.reason ?? "gamification_projection_rebuild_without_session_hint",
        trx,
      );
    }

    await applyVibeLevelDecayForUser(userId, trx);
    await markGamificationProjectionFresh(userId, POINTS_ALGORITHM_VERSION, trx);
    return { rebuilt: true, sessionsProcessed };
  });

  logger.info({ userId, ...result }, "[points] Reconciled gamification projection");
  return result;
}

export async function ensureGamificationProjectionFresh(userId: string): Promise<void> {
  const state = await getGamificationProjectionState(userId);
  if (state?.isStale === false && state.algorithmVersion === POINTS_ALGORITHM_VERSION) {
    return;
  }
  await reconcileGamificationProjection(userId, {
    forceFullRebuild: state === null || state?.rebuildRequired === true,
    reason: "on_demand_stale_projection",
  });
}
