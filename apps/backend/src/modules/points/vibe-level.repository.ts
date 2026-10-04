import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import type {
  DomainCode,
  DomainVibeLevel,
  InsertVibeLevelChange,
  VibeLevelChangeRecord,
} from "./points.types.js";

const VIBE_LEVEL_LOCK_PREFIX = "fitvibe:vibe-level";

function executor(trx?: Knex.Transaction) {
  return trx ?? db;
}

function toIsoString(value: unknown): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return new Date(value as number).toISOString();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

interface DomainVibeLevelRow {
  user_id: string;
  domain_code: string;
  vibe_level: string | number;
  rating_deviation: string | number;
  volatility: string | number;
  last_updated_at: Date | string | number | null;
  created_at: Date | string | number | null;
  updated_at: Date | string | number | null;
}

interface VibeLevelChangeRow {
  id: string;
  user_id: string;
  domain_code: string;
  session_id: string | null;
  old_vibe_level: string | number;
  new_vibe_level: string | number;
  old_rd: string | number;
  new_rd: string | number;
  change_amount: string | number;
  performance_score: string | number | null;
  domain_impact: string | number | null;
  points_awarded: string | number | null;
  change_reason: string;
  metadata: unknown;
  created_at: Date | string | number | null;
}

function toDomainVibeLevel(row: DomainVibeLevelRow): DomainVibeLevel {
  return {
    user_id: row.user_id,
    domain_code: row.domain_code as DomainCode,
    vibe_level: Number(row.vibe_level),
    rating_deviation: Number(row.rating_deviation),
    volatility: Number(row.volatility),
    last_updated_at: toIsoString(row.last_updated_at),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function toVibeLevelChangeRecord(row: VibeLevelChangeRow): VibeLevelChangeRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    domain_code: row.domain_code as DomainCode,
    session_id: row.session_id ?? null,
    old_vibe_level: Number(row.old_vibe_level),
    new_vibe_level: Number(row.new_vibe_level),
    old_rd: Number(row.old_rd),
    new_rd: Number(row.new_rd),
    change_amount: Number(row.change_amount),
    performance_score:
      row.performance_score === null || row.performance_score === undefined
        ? null
        : Number(row.performance_score),
    domain_impact:
      row.domain_impact === null || row.domain_impact === undefined
        ? null
        : Number(row.domain_impact),
    points_awarded:
      row.points_awarded === null || row.points_awarded === undefined
        ? null
        : Number(row.points_awarded),
    change_reason: row.change_reason as "session_completed" | "decay" | "manual_adjustment",
    metadata: toRecord(row.metadata),
    created_at: toIsoString(row.created_at),
  };
}

export async function lockVibeLevelsForUser(userId: string, trx: Knex.Transaction): Promise<void> {
  await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
    `${VIBE_LEVEL_LOCK_PREFIX}:${userId}`,
  ]);
}

export async function getDomainVibeLevel(
  userId: string,
  domainCode: DomainCode,
  trx?: Knex.Transaction,
): Promise<DomainVibeLevel | undefined> {
  const exec = executor(trx);
  const row = await exec<DomainVibeLevelRow>("user_domain_vibe_levels")
    .where({ user_id: userId, domain_code: domainCode })
    .first();

  return row ? toDomainVibeLevel(row) : undefined;
}

export async function getAllDomainVibeLevels(
  userId: string,
  trx?: Knex.Transaction,
): Promise<Map<DomainCode, DomainVibeLevel>> {
  const exec = executor(trx);
  const rows = await exec<DomainVibeLevelRow>("user_domain_vibe_levels")
    .where({ user_id: userId })
    .select<DomainVibeLevelRow[]>([
      "user_id",
      "domain_code",
      "vibe_level",
      "rating_deviation",
      "volatility",
      "last_updated_at",
      "created_at",
      "updated_at",
    ]);

  const map = new Map<DomainCode, DomainVibeLevel>();
  for (const row of rows) {
    map.set(row.domain_code as DomainCode, toDomainVibeLevel(row));
  }
  return map;
}

export async function getStaleDomainVibeLevels(
  cutoffIso: string,
  trx?: Knex.Transaction,
  userId?: string,
): Promise<DomainVibeLevel[]> {
  const exec = executor(trx);
  const query = exec<DomainVibeLevelRow>("user_domain_vibe_levels").where(
    "last_updated_at",
    "<",
    cutoffIso,
  );
  if (userId) {
    query.andWhere({ user_id: userId });
  }
  const rows = await query.select<DomainVibeLevelRow[]>([
    "user_id",
    "domain_code",
    "vibe_level",
    "rating_deviation",
    "volatility",
    "last_updated_at",
    "created_at",
    "updated_at",
  ]);

  return rows.map(toDomainVibeLevel);
}

export async function updateDomainVibeLevel(
  userId: string,
  domainCode: DomainCode,
  vibeLevel: number,
  ratingDeviation: number,
  volatility: number,
  trx?: Knex.Transaction,
  effectiveAt?: string,
): Promise<void> {
  const exec = executor(trx);
  const now = new Date().toISOString();
  const lastUpdatedAt = effectiveAt ?? now;

  await exec("user_domain_vibe_levels")
    .insert({
      user_id: userId,
      domain_code: domainCode,
      vibe_level: vibeLevel,
      rating_deviation: ratingDeviation,
      volatility,
      last_updated_at: lastUpdatedAt,
      created_at: now,
      updated_at: now,
    })
    .onConflict(["user_id", "domain_code"])
    .merge({
      vibe_level: vibeLevel,
      rating_deviation: ratingDeviation,
      volatility,
      last_updated_at: lastUpdatedAt,
      updated_at: now,
    });
}

export async function insertVibeLevelChange(
  change: InsertVibeLevelChange,
  trx?: Knex.Transaction,
): Promise<VibeLevelChangeRecord> {
  const exec = executor(trx);
  const [row] = await exec<VibeLevelChangeRow>("vibe_level_changes")
    .insert({
      user_id: change.user_id,
      domain_code: change.domain_code,
      session_id: change.session_id ?? null,
      old_vibe_level: change.old_vibe_level,
      new_vibe_level: change.new_vibe_level,
      old_rd: change.old_rd,
      new_rd: change.new_rd,
      change_amount: change.change_amount,
      performance_score: change.performance_score ?? null,
      domain_impact: change.domain_impact ?? null,
      points_awarded: change.points_awarded ?? null,
      change_reason: change.change_reason,
      metadata: change.metadata,
    })
    .returning<VibeLevelChangeRow[]>(["*"]);

  return toVibeLevelChangeRecord(row);
}
