import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import type {
  BadgeAwardRecord,
  BadgeCatalogEntry,
  ExerciseMetadata,
  InsertPointsEvent,
  InsertBadgeAward,
  PointsEventRecord,
  UserPointsProfile,
} from "./points.types.js";

const TABLE = "user_points";

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

function normalizeTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
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

interface PointsEventRow {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  algorithm_version: string | null;
  points: string | number;
  calories: string | number | null;
  metadata: unknown;
  awarded_at: Date | string | number | null;
  created_at: Date | string | number | null;
}

interface ProfileRow {
  user_id: string;
  date_of_birth: string | null;
  gender_code: string | null;
}

interface UserMetricsRow {
  user_id: string;
  fitness_level_code: string | null;
  training_frequency: string | null;
  recorded_at: Date | string | null;
}

interface ExerciseRow {
  id: string;
  type_code: string | null;
  tags: unknown;
}

interface BadgeCatalogRow {
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  priority: string | number | null;
  criteria: unknown;
}

interface BadgeRow {
  id: string;
  user_id: string;
  badge_type: string;
  is_active: boolean;
  awarded_at: Date | string | number | null;
}

interface CompletedSessionRow {
  owner_id: string;
  status: string;
  completed_at: Date | string | null;
}

interface BadgeAwardRow {
  id: string;
  user_id: string;
  badge_type: string;
  metadata: unknown;
  awarded_at: Date | string | number | null;
}

const POINTS_EVENT_COLUMNS = [
  "id",
  "user_id",
  "source_type",
  "source_id",
  "algorithm_version",
  "points",
  "calories",
  "metadata",
  "awarded_at",
  "created_at",
] as const;

type PointsEventQueryBuilder = Knex.QueryBuilder<PointsEventRow, PointsEventRow[]>;

function toPointsEventRecord(row: PointsEventRow): PointsEventRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    source_type: row.source_type,
    source_id: row.source_id ?? null,
    algorithm_version: row.algorithm_version ?? null,
    points: Number(row.points),
    calories: row.calories === null || row.calories === undefined ? null : Number(row.calories),
    metadata: toRecord(row.metadata),
    awarded_at: toIsoString(row.awarded_at),
    created_at: toIsoString(row.created_at),
  };
}

export async function insertPointsEvent(
  event: InsertPointsEvent,
  trx?: Knex.Transaction,
): Promise<PointsEventRecord> {
  const exec = executor(trx);
  const [row] = await exec<PointsEventRow>(TABLE)
    .insert(event)
    .returning<PointsEventRow[]>(POINTS_EVENT_COLUMNS);
  return toPointsEventRecord(row);
}

export async function findPointsEventBySource(
  userId: string,
  sourceType: string,
  sourceId: string,
  trx?: Knex.Transaction,
): Promise<PointsEventRecord | undefined> {
  const exec = executor(trx);
  const row = await exec<PointsEventRow>(TABLE)
    .select<PointsEventRow[]>(POINTS_EVENT_COLUMNS)
    .where({
      user_id: userId,
      source_type: sourceType,
      source_id: sourceId,
    })
    .first();
  return row ? toPointsEventRecord(row) : undefined;
}

export async function getPointsBalance(userId: string, trx?: Knex.Transaction): Promise<number> {
  const exec = executor(trx);
  const result = await exec(TABLE)
    .where({ user_id: userId })
    .sum<{ total: string | number }>("points as total")
    .first();
  const value = result?.total ?? 0;
  return typeof value === "string" ? Number(value) : Number(value ?? 0);
}

export async function getRecentPointsEvents(
  userId: string,
  limit: number,
  trx?: Knex.Transaction,
): Promise<PointsEventRecord[]> {
  const exec = executor(trx);
  const rows = await exec<PointsEventRow>(TABLE)
    .select<PointsEventRow[]>(POINTS_EVENT_COLUMNS)
    .where({ user_id: userId })
    .orderBy("awarded_at", "desc")
    .orderBy("id", "desc")
    .limit(limit);
  return rows.map(toPointsEventRecord);
}

export interface HistoryCursor {
  awardedAt: Date;
  id: string;
}

export interface PointsHistoryOptions {
  limit: number;
  cursor?: HistoryCursor;
  from?: Date;
  to?: Date;
}

export async function getPointsHistory(
  userId: string,
  options: PointsHistoryOptions,
  trx?: Knex.Transaction,
): Promise<PointsEventRecord[]> {
  const exec = executor(trx);
  const query = exec<PointsEventRow>(TABLE)
    .select<PointsEventRow[]>(POINTS_EVENT_COLUMNS)
    .where({ user_id: userId })
    .orderBy("awarded_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit);

  if (options.from) {
    query.andWhere("awarded_at", ">=", options.from);
  }
  if (options.to) {
    query.andWhere("awarded_at", "<=", options.to);
  }
  if (options.cursor) {
    query.andWhere((builder: PointsEventQueryBuilder) => {
      builder
        .where("awarded_at", "<", options.cursor!.awardedAt)
        .orWhere((inner: PointsEventQueryBuilder) => {
          inner
            .where("awarded_at", "=", options.cursor!.awardedAt)
            .andWhere("id", "<", options.cursor!.id);
        });
    });
  }

  const rows = await query;
  return rows.map(toPointsEventRecord);
}

export async function getUserPointsProfile(
  userId: string,
  trx?: Knex.Transaction,
): Promise<UserPointsProfile> {
  const exec = executor(trx);
  const profile = await exec<ProfileRow & UserMetricsRow>("profiles")
    .select<Array<ProfileRow & UserMetricsRow>>([
      "date_of_birth",
      "gender_code",
      "fitness_level_code",
      "training_frequency",
    ])
    .where({ user_id: userId })
    .first();

  return {
    dateOfBirth: profile?.date_of_birth ?? null,
    genderCode: profile?.gender_code ?? null,
    fitnessLevelCode: profile?.fitness_level_code ?? null,
    trainingFrequency: profile?.training_frequency ?? null,
  };
}

export async function getExercisesMetadata(
  exerciseIds: string[],
  trx?: Knex.Transaction,
): Promise<Map<string, ExerciseMetadata>> {
  if (exerciseIds.length === 0) {
    return new Map();
  }
  const exec = executor(trx);
  const rows = await exec<ExerciseRow>("exercises")
    .whereIn("id", exerciseIds)
    .select<ExerciseRow[]>(["id", "type_code", "tags"]);

  const map = new Map<string, ExerciseMetadata>();
  for (const row of rows) {
    const tags = normalizeTagList(row.tags);
    map.set(row.id, {
      id: row.id,
      type_code: row.type_code ?? null,
      tags,
    });
  }
  return map;
}

export async function getBadgeCatalog(
  trx?: Knex.Transaction,
): Promise<Map<string, BadgeCatalogEntry>> {
  const exec = executor(trx);
  const rows = await exec<BadgeCatalogRow>("badge_catalog").select<BadgeCatalogRow[]>([
    "code",
    "name",
    "description",
    "category",
    "icon",
    "priority",
    "criteria",
  ]);
  const map = new Map<string, BadgeCatalogEntry>();
  for (const row of rows) {
    map.set(row.code, {
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      category: row.category ?? "",
      icon: row.icon ?? null,
      priority: Number(row.priority ?? 0),
      criteria: toRecord(row.criteria),
    });
  }
  return map;
}

export async function getUserBadgeCodes(
  userId: string,
  trx?: Knex.Transaction,
): Promise<Set<string>> {
  const exec = executor(trx);
  const rows = await exec<BadgeRow>("badges")
    .where({ user_id: userId, is_active: true })
    .select<BadgeRow[]>(["badge_type"]);
  return new Set(rows.map((row) => row.badge_type));
}

export async function getUserBadges(
  userId: string,
  trx?: Knex.Transaction,
): Promise<Array<BadgeCatalogEntry & { id: string; earnedAt: string }>> {
  const exec = executor(trx);
  const rows = await exec<BadgeRow>("badges")
    .where({ user_id: userId, is_active: true })
    .select<BadgeRow[]>(["id", "badge_type", "awarded_at"])
    .orderBy("awarded_at", "desc");
  const catalog = await getBadgeCatalog(trx);

  return rows.flatMap((row) => {
    const definition = catalog.get(row.badge_type);
    if (!definition) {
      return [];
    }
    return [{ ...definition, id: row.id, earnedAt: toIsoString(row.awarded_at) }];
  });
}

export async function insertBadgeAward(
  award: InsertBadgeAward,
  trx?: Knex.Transaction,
): Promise<BadgeAwardRecord> {
  const exec = executor(trx);
  const [row] = await exec<BadgeAwardRow>("badges")
    .insert({
      ...award,
      metadata: award.metadata,
    })
    .returning<BadgeAwardRow[]>(["id", "user_id", "badge_type", "metadata", "awarded_at"]);

  return {
    id: row.id,
    user_id: row.user_id,
    badge_type: row.badge_type,
    metadata: toRecord(row.metadata),
    awarded_at: toIsoString(row.awarded_at),
  };
}

export async function countCompletedSessions(
  userId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = executor(trx);
  const row = await exec("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .count<{ count: string | number }>("id as count")
    .first();
  const value = row?.count ?? 0;
  return typeof value === "string" ? Number(value) : Number(value ?? 0);
}

export async function getCompletedSessionDatesInRange(
  userId: string,
  from: Date,
  to: Date,
  trx?: Knex.Transaction,
): Promise<Set<string>> {
  const exec = executor(trx);
  const rows: CompletedSessionRow[] = await exec<CompletedSessionRow>("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .whereBetween("completed_at", [from, to])
    .select<CompletedSessionRow[]>(["completed_at"]);

  const days = new Set<string>();
  for (const row of rows) {
    if (!row.completed_at) {
      continue;
    }
    const iso = toIsoString(row.completed_at);
    days.add(iso.slice(0, 10));
  }
  return days;
}

export async function getCompletedSessionTypeCodeCounts(
  userId: string,
  trx?: Knex.Transaction,
): Promise<Map<string, number>> {
  const exec = executor(trx);
  const rows = (await exec("sessions as s")
    .join("session_exercises as se", "se.session_id", "s.id")
    .join("exercises as e", "e.id", "se.exercise_id")
    .where({ "s.owner_id": userId, "s.status": "completed" })
    .whereNull("s.deleted_at")
    .whereNotNull("e.type_code")
    .groupBy("e.type_code")
    .select("e.type_code as type_code")
    .countDistinct("s.id as count")) as Array<{ type_code: string; count: string | number }>;

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.type_code, Number(row.count));
  }
  return map;
}

export async function getDistinctTypeCodesInWindow(
  userId: string,
  from: Date,
  to: Date,
  trx?: Knex.Transaction,
): Promise<Set<string>> {
  const exec = executor(trx);
  const rows = await exec("sessions as s")
    .join("session_exercises as se", "se.session_id", "s.id")
    .join("exercises as e", "e.id", "se.exercise_id")
    .where({ "s.owner_id": userId, "s.status": "completed" })
    .whereNull("s.deleted_at")
    .whereNotNull("e.type_code")
    .whereBetween("s.completed_at", [from, to])
    .distinct<{ type_code: string }[]>("e.type_code as type_code");

  return new Set(rows.map((row) => row.type_code).filter(Boolean));
}

export async function countCompletedSessionsOnUtcDay(
  userId: string,
  dayIso: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = executor(trx);
  const start = new Date(`${dayIso}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const row = await exec("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .where("completed_at", ">=", start)
    .where("completed_at", "<", end)
    .count<{ count: string | number }>("id as count")
    .first();
  const value = row?.count ?? 0;
  return typeof value === "string" ? Number(value) : Number(value ?? 0);
}

export async function countPersonalRecords(
  userId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = executor(trx);
  const row = await exec("personal_records")
    .where({ user_id: userId })
    .count<{ count: string | number }>("id as count")
    .first();
  const value = row?.count ?? 0;
  return typeof value === "string" ? Number(value) : Number(value ?? 0);
}

export async function countFollowsByUser(userId: string, trx?: Knex.Transaction): Promise<number> {
  const exec = executor(trx);
  const row = await exec("followers")
    .where({ follower_id: userId })
    .count<{ count: string | number }>("follower_id as count")
    .first();
  const value = row?.count ?? 0;
  return typeof value === "string" ? Number(value) : Number(value ?? 0);
}

export {
  getAllDomainVibeLevels,
  getDomainVibeLevel,
  getStaleDomainVibeLevels,
  insertVibeLevelChange,
  lockVibeLevelsForUser,
  updateDomainVibeLevel,
} from "./vibe-level.repository.js";

export interface GamificationProjectionState {
  userId: string;
  isStale: boolean;
  rebuildRequired: boolean;
  algorithmVersion: string | null;
  staleSince: string | null;
  lastRebuiltAt: string | null;
}

export async function lockPointsSource(
  userId: string,
  sourceId: string,
  trx: Knex.Transaction,
): Promise<void> {
  await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
    `fitvibe:points-source:${userId}:${sourceId}`,
  ]);
}

export async function lockGamificationProjectionForUser(
  userId: string,
  trx: Knex.Transaction,
): Promise<void> {
  await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
    `fitvibe:gamification-projection:${userId}`,
  ]);
}

export async function getGamificationProjectionState(
  userId: string,
  trx?: Knex.Transaction,
): Promise<GamificationProjectionState | null> {
  const exec = executor(trx);
  const row = await exec("user_gamification_projection_state").where({ user_id: userId }).first<{
    user_id: string;
    is_stale: boolean;
    rebuild_required: boolean;
    algorithm_version: string | null;
    stale_since: Date | string | null;
    last_rebuilt_at: Date | string | null;
  }>();
  if (!row) {
    return null;
  }
  return {
    userId: row.user_id,
    isStale: Boolean(row.is_stale),
    rebuildRequired: Boolean(row.rebuild_required),
    algorithmVersion: row.algorithm_version ?? null,
    staleSince: row.stale_since ? toIsoString(row.stale_since) : null,
    lastRebuiltAt: row.last_rebuilt_at ? toIsoString(row.last_rebuilt_at) : null,
  };
}

export async function markGamificationProjectionStale(
  userId: string,
  rebuildRequired: boolean,
  trx?: Knex.Transaction,
): Promise<void> {
  const exec = executor(trx);
  const now = new Date().toISOString();
  await exec("user_gamification_projection_state")
    .insert({
      user_id: userId,
      is_stale: true,
      rebuild_required: rebuildRequired,
      stale_since: now,
      updated_at: now,
    })
    .onConflict("user_id")
    .merge({
      is_stale: true,
      rebuild_required: exec.raw(
        "user_gamification_projection_state.rebuild_required OR EXCLUDED.rebuild_required",
      ),
      stale_since: exec.raw(
        "COALESCE(user_gamification_projection_state.stale_since, EXCLUDED.stale_since)",
      ),
      updated_at: now,
    });
}

export async function markGamificationProjectionFresh(
  userId: string,
  algorithmVersion: string,
  trx?: Knex.Transaction,
): Promise<void> {
  const exec = executor(trx);
  const now = new Date().toISOString();
  await exec("user_gamification_projection_state")
    .insert({
      user_id: userId,
      is_stale: false,
      rebuild_required: false,
      algorithm_version: algorithmVersion,
      stale_since: null,
      last_rebuilt_at: now,
      updated_at: now,
    })
    .onConflict("user_id")
    .merge({
      is_stale: false,
      rebuild_required: false,
      algorithm_version: algorithmVersion,
      stale_since: null,
      last_rebuilt_at: now,
      updated_at: now,
    });
}

export async function archiveAndDeleteDerivedPoints(
  userId: string,
  revisionReason: string,
  trx: Knex.Transaction,
): Promise<void> {
  const sourceTypes = ["session_completed", "streak_bonus", "seasonal_event"];
  await trx.raw(
    `
      INSERT INTO points_event_revisions (
        points_event_id,
        user_id,
        source_type,
        source_id,
        algorithm_version,
        points,
        calories,
        metadata,
        awarded_at,
        revision_reason,
        revised_at
      )
      SELECT
        id,
        user_id,
        source_type,
        source_id,
        algorithm_version,
        points,
        calories,
        metadata,
        awarded_at,
        ?,
        now()
      FROM user_points
      WHERE user_id = ?
        AND source_type = ANY(?::text[])
    `,
    [revisionReason, userId, sourceTypes],
  );
  await trx(TABLE).where({ user_id: userId }).whereIn("source_type", sourceTypes).del();
}

export async function supersedeSessionDerivedGamification(
  userId: string,
  trx: Knex.Transaction,
): Promise<void> {
  const now = new Date().toISOString();

  await trx("vibe_level_changes")
    .where({ user_id: userId, is_active: true })
    .whereIn("change_reason", ["session_completed", "decay"])
    .update({ is_active: false, superseded_at: now });

  await trx("user_domain_vibe_levels").where({ user_id: userId }).del();

  await trx("badges")
    .where({ user_id: userId, is_active: true })
    .whereRaw("jsonb_exists(metadata, ?)", ["session_id"])
    .update({ is_active: false, superseded_at: now });

  await trx("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .update({ points: null, updated_at: now });
}
