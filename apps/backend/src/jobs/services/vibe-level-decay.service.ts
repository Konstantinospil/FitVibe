import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import {
  getDomainVibeLevel,
  getStaleDomainVibeLevels,
  insertVibeLevelChange,
  lockVibeLevelsForUser,
  updateDomainVibeLevel,
} from "../../modules/points/vibe-level.repository.js";

const DECAY_LOCK_NAME = "fitvibe:vibe-level-decay";

async function applyDecayForUser(
  outerTrx: Knex.Transaction,
  oneDayAgo: Date,
  userId?: string,
): Promise<number> {
  const staleRatings = userId
    ? await getStaleDomainVibeLevels(oneDayAgo.toISOString(), outerTrx, userId)
    : await getStaleDomainVibeLevels(oneDayAgo.toISOString(), outerTrx);

  logger.info(
    { count: staleRatings.length, userId: userId ?? null },
    "[vibe-level-decay] Found domains requiring decay",
  );

  let processedCount = 0;
  let decayedCount = 0;

  for (const candidate of staleRatings) {
    try {
      const decayed = await outerTrx.transaction(async (trx: Knex.Transaction) => {
        await lockVibeLevelsForUser(candidate.user_id, trx);

        const current = await getDomainVibeLevel(candidate.user_id, candidate.domain_code, trx);
        if (!current) {
          return false;
        }

        const lastUpdated = new Date(current.last_updated_at);
        if (lastUpdated.getTime() >= oneDayAgo.getTime()) {
          return false;
        }

        const now = new Date();
        const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 1) {
          return false;
        }

        const decayDays = Math.floor(daysSinceUpdate);
        const vibeLevelLoss = Math.min(50, decayDays);
        const rdIncrease = Math.min(50, decayDays * 2);
        const volatilityIncrease = current.volatility * 0.01;

        const newVibeLevel = Math.max(100, current.vibe_level - vibeLevelLoss);
        const newRd = Math.min(350, current.rating_deviation + rdIncrease);
        const newVolatility = Math.min(0.1, current.volatility + volatilityIncrease);

        await updateDomainVibeLevel(
          current.user_id,
          current.domain_code,
          newVibeLevel,
          newRd,
          newVolatility,
          trx,
        );

        await insertVibeLevelChange(
          {
            user_id: current.user_id,
            domain_code: current.domain_code,
            session_id: null,
            old_vibe_level: current.vibe_level,
            new_vibe_level: newVibeLevel,
            old_rd: current.rating_deviation,
            new_rd: newRd,
            change_amount: newVibeLevel - current.vibe_level,
            performance_score: null,
            domain_impact: null,
            points_awarded: null,
            change_reason: "decay",
            metadata: {
              days_since_update: decayDays,
              decay_days: decayDays,
            },
          },
          trx,
        );

        return true;
      });

      if (decayed) {
        decayedCount += 1;
      }
    } catch (error) {
      logger.error(
        {
          userId: candidate.user_id,
          domain: candidate.domain_code,
          error: error instanceof Error ? error.message : String(error),
        },
        "[vibe-level-decay] Failed to apply decay",
      );
    }

    processedCount += 1;
  }

  logger.info(
    { processed: processedCount, decayed: decayedCount, userId: userId ?? null },
    "[vibe-level-decay] Decay process completed",
  );
  return decayedCount;
}

export async function applyVibeLevelDecayForUser(
  userId: string,
  trx?: Knex.Transaction,
): Promise<{ skipped: boolean; decayed: number }> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  if (trx) {
    return {
      skipped: false,
      decayed: await applyDecayForUser(trx, oneDayAgo, userId),
    };
  }

  return db.transaction(async (activeTrx: Knex.Transaction) => ({
    skipped: false,
    decayed: await applyDecayForUser(activeTrx, oneDayAgo, userId),
  }));
}

export async function applyVibeLevelDecay(): Promise<{ skipped: boolean; decayed: number }> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return db.transaction(async (outerTrx: Knex.Transaction) => {
    const lockResult = await outerTrx.raw<{ rows: Array<{ acquired: boolean }> }>(
      "SELECT pg_try_advisory_xact_lock(hashtext(?)) AS acquired",
      [DECAY_LOCK_NAME],
    );
    const acquired = Boolean(lockResult.rows?.[0]?.acquired);
    if (!acquired) {
      logger.info("[vibe-level-decay] Another decay run is active; skipping duplicate execution");
      return { skipped: true, decayed: 0 };
    }

    logger.info("[vibe-level-decay] Starting decay process");
    return {
      skipped: false,
      decayed: await applyDecayForUser(outerTrx, oneDayAgo),
    };
  });
}
