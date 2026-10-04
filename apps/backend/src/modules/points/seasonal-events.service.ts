import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import { insertPointsEvent } from "./points.repository.js";
import {
  getSeasonalEventPolicies,
  type SeasonalEventPolicy,
} from "./gamification-policy.repository.js";

export type SeasonalEvent = SeasonalEventPolicy;

/** Load the versioned designer-owned events applicable at the supplied timestamp. */
export async function getActiveEvents(
  now: Date = new Date(),
  trx?: Knex.Transaction,
): Promise<SeasonalEvent[]> {
  return getSeasonalEventPolicies(now, trx);
}

/**
 * Check if a user has already received a seasonal event bonus
 *
 * @param userId - User ID
 * @param eventCode - Event code to check
 * @param trx - Optional transaction
 * @returns True if bonus already awarded
 */
async function hasReceivedEventBonus(
  userId: string,
  eventCode: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const exec = trx ?? db;

  const result = await exec("user_points")
    .where({
      user_id: userId,
      source_type: "seasonal_event",
    })
    .whereRaw("metadata->>'event_code' = ?", [eventCode])
    .whereRaw("metadata->>'bonus_type' = ?", ["completion"])
    .first<{ user_id: string } | undefined>();

  return result !== undefined;
}

/**
 * Count sessions completed during a seasonal event period
 *
 * @param userId - User ID
 * @param startDate - Event start date
 * @param endDate - Event end date
 * @param trx - Optional transaction
 * @returns Number of completed sessions
 */
async function countEventSessions(
  userId: string,
  startDate: Date,
  endDate: Date,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = trx ?? db;

  const result = await exec("sessions")
    .where({
      owner_id: userId,
      status: "completed",
    })
    .whereNull("deleted_at")
    .whereBetween("completed_at", [startDate, endDate])
    .count<{ count: string }>("* as count")
    .first();

  return parseInt(result?.count ?? "0", 10);
}

/**
 * Award seasonal event bonus for completing minimum sessions
 *
 * @param userId - User ID
 * @param sessionId - Triggering session ID
 * @param event - The seasonal event
 * @param sessionCount - Number of sessions completed during event
 * @param completedAt - Completion timestamp
 * @param trx - Optional transaction
 */
async function awardEventCompletionBonus(
  userId: string,
  sessionId: string,
  event: SeasonalEvent,
  sessionCount: number,
  completedAt: Date,
  trx?: Knex.Transaction,
): Promise<void> {
  const now = new Date();
  await insertPointsEvent(
    {
      id: uuidv4(),
      user_id: userId,
      source_type: "seasonal_event",
      source_id: sessionId,
      points: event.bonusPoints,
      calories: null,
      algorithm_version: event.policyVersion,
      metadata: {
        event_code: event.code,
        event_name: event.name,
        bonus_type: "completion",
        sessions_completed: sessionCount,
        sessions_required: event.minSessionsForBonus,
      },
      awarded_at: completedAt,
      created_at: now,
    },
    trx,
  );

  logger.info(
    { userId, sessionId, eventCode: event.code, bonusPoints: event.bonusPoints, sessionCount },
    "[seasonal-events] Awarded event completion bonus",
  );
}

/**
 * Evaluate seasonal events and award bonuses
 * Called asynchronously after session completion via queue job
 *
 * @param userId - User ID
 * @param sessionId - Completed session ID
 * @param completedAt - Session completion timestamp
 */
export async function evaluateSeasonalEvents(
  userId: string,
  sessionId: string,
  completedAt: string | Date,
  trx?: Knex.Transaction,
): Promise<{ eventsEvaluated: number; bonusesAwarded: number; totalPoints: number }> {
  const completedDate = typeof completedAt === "string" ? new Date(completedAt) : completedAt;

  const run = async (activeTrx: Knex.Transaction) => {
    const activeEvents = await getActiveEvents(completedDate, activeTrx);

    if (activeEvents.length === 0) {
      logger.debug({ userId, sessionId }, "[seasonal-events] No active events");
      return { eventsEvaluated: 0, bonusesAwarded: 0, totalPoints: 0 };
    }

    let bonusesAwarded = 0;
    let totalPoints = 0;

    for (const event of activeEvents) {
      // Check if user already received completion bonus for this event
      const alreadyAwarded = await hasReceivedEventBonus(userId, event.code, activeTrx);
      if (alreadyAwarded) {
        logger.debug(
          { userId, eventCode: event.code },
          "[seasonal-events] User already received bonus for this event",
        );
        continue;
      }

      // Count sessions completed during event period
      const sessionCount = await countEventSessions(
        userId,
        event.startDate,
        event.endDate,
        activeTrx,
      );

      logger.debug(
        { userId, eventCode: event.code, sessionCount, required: event.minSessionsForBonus },
        "[seasonal-events] Evaluated event progress",
      );

      // Award completion bonus if threshold met
      if (sessionCount >= event.minSessionsForBonus) {
        await awardEventCompletionBonus(
          userId,
          sessionId,
          event,
          sessionCount,
          completedDate,
          activeTrx,
        );
        bonusesAwarded++;
        totalPoints += event.bonusPoints;
      }
    }

    return {
      eventsEvaluated: activeEvents.length,
      bonusesAwarded,
      totalPoints,
    };
  };

  return trx ? run(trx) : db.transaction(run);
}
