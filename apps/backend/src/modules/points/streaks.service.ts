import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import {
  findPointsEventBySource,
  getCompletedSessionDatesInRange,
  insertPointsEvent,
} from "./points.repository.js";
import { getGamificationPolicy } from "./gamification-policy.repository.js";

/**
 * Calculate the current workout streak for a user
 * A streak is maintained by completing at least one session per day
 *
 * @param userId - The user ID
 * @param completedAt - The date to calculate streak from (usually current session completion)
 * @param trx - Optional transaction
 * @returns Current streak length in days
 */
export async function calculateCurrentStreak(
  userId: string,
  completedAt: Date,
  trx?: Knex.Transaction,
): Promise<number> {
  const policy = await getGamificationPolicy(completedAt, trx);
  const lookbackStart = new Date(completedAt);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - policy.streakLookbackDays);

  const completedDates = await getCompletedSessionDatesInRange(
    userId,
    lookbackStart,
    completedAt,
    trx,
  );

  if (completedDates.size === 0) {
    return 0;
  }

  // Start from completion date and count backwards
  let streakLength = 0;
  const cursor = new Date(completedAt);
  cursor.setUTCHours(0, 0, 0, 0); // Normalize to start of day

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (completedDates.has(dateStr)) {
      streakLength++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      // Streak broken
      break;
    }

    if (streakLength >= policy.streakLookbackDays) {
      break;
    }
  }

  return streakLength;
}

/**
 * Award streak bonus points based on current streak length
 * Bonus points are awarded for maintaining consecutive workout days:
 * - 3-6 days: 5 bonus points
 * - 7-13 days: 10 bonus points
 * - 14-29 days: 20 bonus points
 * - 30+ days: 50 bonus points
 *
 * @param userId - The user ID
 * @param sessionId - The session that maintained/extended the streak
 * @param streakLength - Current streak length in days
 * @param completedAt - When the session was completed
 * @param trx - Optional transaction
 */
export async function awardStreakBonus(
  userId: string,
  sessionId: string,
  streakLength: number,
  completedAt: Date,
  trx?: Knex.Transaction,
): Promise<number> {
  const policy = await getGamificationPolicy(completedAt, trx);
  const applicableTier = [...policy.streakTiers]
    .sort((a, b) => b.minDays - a.minDays)
    .find((tier) => streakLength >= tier.minDays);
  const bonusPoints = applicableTier?.bonusPoints ?? 0;

  // No bonus for streaks less than 3 days
  if (bonusPoints === 0) {
    return 0;
  }

  const existing = await findPointsEventBySource(userId, "streak_bonus", sessionId, trx);
  if (existing) {
    return existing.points;
  }

  // Record the streak bonus points
  const now = new Date();
  await insertPointsEvent(
    {
      id: uuidv4(),
      user_id: userId,
      source_type: "streak_bonus",
      source_id: sessionId,
      points: bonusPoints,
      calories: null,
      algorithm_version: policy.versionCode,
      metadata: {
        streak_days: streakLength,
        bonus_tier: bonusPoints,
      },
      awarded_at: completedAt,
      created_at: now,
    },
    trx,
  );

  logger.info(
    { userId, sessionId, streakLength, bonusPoints },
    "[streaks] Awarded streak bonus points",
  );

  return bonusPoints;
}

/**
 * Evaluate streaks and award bonus points for a completed session
 * This is called asynchronously after session completion via queue job
 *
 * @param userId - The user ID
 * @param sessionId - The completed session ID
 * @param completedAt - When the session was completed
 */
export async function evaluateStreakBonus(
  userId: string,
  sessionId: string,
  completedAt: string | Date,
  trx?: Knex.Transaction,
): Promise<{ streakLength: number; bonusPoints: number }> {
  const completedDate = typeof completedAt === "string" ? new Date(completedAt) : completedAt;

  const run = async (activeTrx: Knex.Transaction) => {
    // Calculate current streak
    const streakLength = await calculateCurrentStreak(userId, completedDate, activeTrx);

    logger.debug({ userId, sessionId, streakLength }, "[streaks] Calculated current streak length");

    // Award bonus points if applicable
    const bonusPoints = await awardStreakBonus(
      userId,
      sessionId,
      streakLength,
      completedDate,
      activeTrx,
    );

    return { streakLength, bonusPoints };
  };

  return trx ? run(trx) : db.transaction(run);
}
