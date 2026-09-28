import type { Knex } from "knex";
import { db } from "../../db/connection.js";

export interface GamificationPolicy {
  versionCode: string;
  streakLookbackDays: number;
  streakTiers: Array<{ minDays: number; bonusPoints: number }>;
}

export interface SeasonalEventPolicy {
  policyVersion: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  multiplier: number;
  minSessionsForBonus: number;
  bonusPoints: number;
}

function executor(trx?: Knex.Transaction) {
  return trx ?? db;
}

async function findPolicyVersion(
  at: Date,
  trx?: Knex.Transaction,
): Promise<{ version_code: string; streak_lookback_days: number } | undefined> {
  return executor(trx)("gamification_policy_versions")
    .where("valid_from", "<=", at)
    .andWhere((query: Knex.QueryBuilder) => {
      query.whereNull("valid_to").orWhere("valid_to", ">", at);
    })
    .orderBy("valid_from", "desc")
    .first<{ version_code: string; streak_lookback_days: number }>();
}

export async function getGamificationPolicy(
  at: Date,
  trx?: Knex.Transaction,
): Promise<GamificationPolicy> {
  const version = await findPolicyVersion(at, trx);
  if (!version) {
    throw new Error(`No gamification policy version applies at ${at.toISOString()}`);
  }

  const tiers = await executor(trx)("gamification_streak_tiers")
    .where({ policy_version: version.version_code })
    .orderBy("min_days", "asc")
    .select<Array<{ min_days: number; bonus_points: number }>>(["min_days", "bonus_points"]);

  return {
    versionCode: version.version_code,
    streakLookbackDays: Number(version.streak_lookback_days),
    streakTiers: tiers.map((tier) => ({
      minDays: Number(tier.min_days),
      bonusPoints: Number(tier.bonus_points),
    })),
  };
}

export async function getSeasonalEventPolicies(
  at: Date,
  trx?: Knex.Transaction,
): Promise<SeasonalEventPolicy[]> {
  const version = await findPolicyVersion(at, trx);
  if (!version) {
    return [];
  }

  const rows = await executor(trx)("gamification_seasonal_events")
    .where({ policy_version: version.version_code })
    .andWhere("start_at", "<=", at)
    .andWhere("end_at", ">=", at)
    .orderBy("start_at", "asc")
    .select<
      Array<{
        policy_version: string;
        code: string;
        name: string;
        start_at: Date | string;
        end_at: Date | string;
        multiplier: string | number;
        min_sessions_for_bonus: number;
        bonus_points: number;
      }>
    >([
      "policy_version",
      "code",
      "name",
      "start_at",
      "end_at",
      "multiplier",
      "min_sessions_for_bonus",
      "bonus_points",
    ]);

  return rows.map((row) => ({
    policyVersion: row.policy_version,
    code: row.code,
    name: row.name,
    startDate: new Date(row.start_at),
    endDate: new Date(row.end_at),
    multiplier: Number(row.multiplier),
    minSessionsForBonus: Number(row.min_sessions_for_bonus),
    bonusPoints: Number(row.bonus_points),
  }));
}
