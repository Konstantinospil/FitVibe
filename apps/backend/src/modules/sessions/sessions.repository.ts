import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type {
  PaginatedResult,
  Session,
  SessionExercise,
  SessionExerciseAttributes,
  SessionExerciseSet,
  SessionQuery,
  SessionWithExercises,
} from "./sessions.types";

interface SessionQueryOptions {
  includeDeleted?: boolean;
}

export interface SessionExerciseSetUpsert {
  id: string;
  order_index: number;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  rest_sec?: number | null;
  extras?: Record<string, unknown>;
  recorded_at?: string | null;
  notes?: string | null;
}

export interface SessionExerciseUpsertInput {
  id: string;
  exercise_id: string | null;
  order_index: number;
  notes: string | null;
  planned?: SessionExerciseAttributes | null;
  sets: SessionExerciseSetUpsert[];
}

export interface RegionalTrainingLoadWindow {
  from: string | Date;
  to: string | Date;
}

export interface RegionalStrengthStimulus {
  region: "upper" | "lower" | "fullBody";
  completedAt: string;
  setCount: number;
  averageRpe: number | null;
}

function executor(trx?: Knex.Transaction) {
  return trx ?? db;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function toDateString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function normalizeExtras(extras: unknown): Record<string, unknown> {
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) {
    return {};
  }
  return extras as Record<string, unknown>;
}

function isAttributesEmpty(attributes?: SessionExerciseAttributes | null): boolean {
  if (!attributes) {
    return true;
  }
  const { sets, reps, load, distance, duration, rpe, rest, extras } = attributes;
  const hasValues =
    (sets !== null && sets !== undefined) ||
    (reps !== null && reps !== undefined) ||
    (load !== null && load !== undefined) ||
    (distance !== null && distance !== undefined) ||
    (duration !== null && duration !== undefined && duration !== "") ||
    (rpe !== null && rpe !== undefined) ||
    (rest !== null && rest !== undefined && rest !== "") ||
    (extras && Object.keys(extras).length > 0);
  return !hasValues;
}

function buildAttributes(
  attributes: SessionExerciseAttributes | null | undefined,
): SessionExerciseAttributes | null {
  if (!attributes) {
    return null;
  }
  const normalizedExtras = normalizeExtras(attributes.extras);
  const candidate: SessionExerciseAttributes = {
    sets: attributes.sets ?? null,
    reps: attributes.reps ?? null,
    load: attributes.load ?? null,
    distance: attributes.distance ?? null,
    duration: attributes.duration ?? null,
    rpe: attributes.rpe ?? null,
    rest: attributes.rest ?? null,
    extras: normalizedExtras,
  };
  return isAttributesEmpty(candidate) ? null : candidate;
}

export async function listSessions(
  userId: string,
  q: SessionQuery,
): Promise<PaginatedResult<Session>> {
  const { status, plan_id, planned_from, planned_to, search, limit = 10, offset = 0 } = q;
  const query = executor()<Session>("sessions").where({ owner_id: userId }).whereNull("deleted_at");

  if (status) {
    query.andWhere({ status });
  }
  if (plan_id) {
    query.andWhere({ plan_id });
  }
  if (planned_from) {
    query.andWhere("planned_at", ">=", planned_from);
  }
  if (planned_to) {
    query.andWhere("planned_at", "<=", planned_to);
  }
  if (search) {
    query.andWhereILike("title", `%${search}%`);
  }

  const totalRow = await query.clone().count<{ count: string }[]>("* as count");
  const total = parseInt(totalRow[0].count, 10);

  const data = await query.clone().orderBy("planned_at", "desc").limit(limit).offset(offset);

  return { data, total, limit, offset };
}

export async function getSessionById(
  id: string,
  userId: string,
  options: SessionQueryOptions = {},
  trx?: Knex.Transaction,
): Promise<Session | undefined> {
  const query = executor(trx)<Session>("sessions").where({ id, owner_id: userId });
  if (!options.includeDeleted) {
    query.whereNull("deleted_at");
  }
  return query.first();
}

type SessionExerciseRow = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string | null; // Snapshot of exercise name
  order_index: number;
  notes: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  planned_sets: number | null;
  planned_reps: number | null;
  planned_load: number | string | null;
  planned_distance: number | string | null;
  planned_duration: string | null;
  planned_rpe: number | null;
  planned_rest: string | null;
  planned_extras: unknown;
};

type SessionExerciseSetRow = {
  id: string;
  session_exercise_id: string;
  order_index: number;
  reps: number | null;
  weight_kg: number | string | null;
  distance_m: number | null;
  duration_sec: number | null;
  rpe: number | null;
  rest_sec: number | null;
  extras: unknown;
  recorded_at: Date | string | null;
  notes: string | null;
  created_at?: Date | string | null;
};

export async function getSessionWithDetails(
  id: string,
  userId: string,
  options: SessionQueryOptions = {},
  trx?: Knex.Transaction,
): Promise<SessionWithExercises | undefined> {
  const session = await getSessionById(id, userId, options, trx);
  if (!session) {
    return undefined;
  }

  const exec = executor(trx);
  const exerciseRows = await exec<SessionExerciseRow>("session_exercises as se")
    .leftJoin("planned_exercise_attributes as plan", "plan.session_exercise_id", "se.id")
    .where("se.session_id", id)
    .orderBy("se.order_index", "asc")
    .select<SessionExerciseRow[]>([
      "se.id as id",
      "se.session_id as session_id",
      "se.exercise_id as exercise_id",
      "se.exercise_name as exercise_name",
      "se.order_index as order_index",
      "se.notes as notes",
      "se.created_at as created_at",
      "se.updated_at as updated_at",
      "plan.sets as planned_sets",
      "plan.reps as planned_reps",
      "plan.load as planned_load",
      "plan.distance as planned_distance",
      "plan.duration as planned_duration",
      "plan.rpe as planned_rpe",
      "plan.rest as planned_rest",
      "plan.extras as planned_extras",
    ]);

  const exerciseIds = exerciseRows.map((row) => row.id);

  const setRows = exerciseIds.length
    ? await exec<SessionExerciseSetRow>("exercise_sets")
        .whereIn("session_exercise_id", exerciseIds)
        .orderBy([
          { column: "session_exercise_id", order: "asc" },
          { column: "order_index", order: "asc" },
        ])
        .select([
          "id",
          "session_exercise_id",
          "order_index",
          "reps",
          "weight_kg",
          "distance_m",
          "duration_sec",
          "rpe",
          "rest_sec",
          "extras",
          "recorded_at",
          "notes",
          "created_at",
        ])
    : [];

  const setsByExercise = new Map<string, SessionExerciseSet[]>();
  for (const row of setRows) {
    const list = setsByExercise.get(row.session_exercise_id) ?? [];
    list.push({
      id: row.id,
      order_index: row.order_index,
      reps: row.reps ?? null,
      weight_kg: toNumber(row.weight_kg),
      distance_m: row.distance_m ?? null,
      duration_sec: row.duration_sec ?? null,
      rpe: row.rpe ?? null,
      rest_sec: row.rest_sec ?? null,
      extras: normalizeExtras(row.extras),
      recorded_at: toDateString(row.recorded_at) ?? null,
      notes: row.notes ?? null,
      created_at: toDateString(row.created_at),
    });
    setsByExercise.set(row.session_exercise_id, list);
  }

  const exercises: SessionExercise[] = exerciseRows.map((row) => {
    const planned: SessionExerciseAttributes | null = buildAttributes({
      sets: row.planned_sets ?? null,
      reps: row.planned_reps ?? null,
      load: toNumber(row.planned_load),
      distance: toNumber(row.planned_distance),
      duration: row.planned_duration ?? null,
      rpe: row.planned_rpe ?? null,
      rest: row.planned_rest ?? null,
      extras: normalizeExtras(row.planned_extras),
    });

    return {
      id: row.id,
      session_id: row.session_id,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name ?? null,
      order_index: row.order_index,
      notes: row.notes ?? null,
      created_at: toDateString(row.created_at),
      updated_at: toDateString(row.updated_at),
      planned,
      actual: null,
      sets: setsByExercise.get(row.id) ?? [],
    };
  });

  return {
    ...session,
    exercises,
  };
}

export async function createSession(row: Session, trx?: Knex.Transaction): Promise<number> {
  return executor(trx)("sessions").insert(row);
}

export async function updateSession(
  id: string,
  userId: string,
  updates: Partial<Session>,
  trx?: Knex.Transaction,
) {
  return executor(trx)("sessions")
    .where({ id, owner_id: userId })
    .whereNull("deleted_at")
    .update({ ...updates, updated_at: new Date().toISOString() });
}

export async function cancelSession(
  id: string,
  userId: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const timestamp = new Date().toISOString();
  return executor(trx)("sessions").where({ id, owner_id: userId }).whereNull("deleted_at").update({
    status: "canceled",
    deleted_at: timestamp,
    updated_at: timestamp,
  });
}

export async function refreshSessionSummary(concurrent = true): Promise<void> {
  await db.raw("SELECT public.refresh_session_summary(?)", [concurrent]);
}

export async function sessionsExistAtDates(
  userId: string,
  plannedDates: string[],
  trx?: Knex.Transaction,
): Promise<string[]> {
  if (!plannedDates.length) {
    return [];
  }

  const rows = (await executor(trx)("sessions")
    .select("planned_at")
    .where({ owner_id: userId })
    .whereNull("deleted_at")
    .whereIn("planned_at", plannedDates)) as Array<{ planned_at: Date | string }>;

  return rows.map(({ planned_at }) => {
    if (planned_at instanceof Date) {
      return planned_at.toISOString();
    }
    return new Date(planned_at).toISOString();
  });
}

export async function replaceSessionExercises(
  trx: Knex.Transaction,
  sessionId: string,
  exercises: SessionExerciseUpsertInput[],
): Promise<void> {
  await trx("session_exercises").where({ session_id: sessionId }).del();

  if (!exercises.length) {
    return;
  }

  const timestamp = new Date().toISOString();

  // Fetch exercise names for exercises that have an exercise_id
  // This creates a snapshot of the exercise name at the time of session creation
  const exerciseIds = exercises
    .map((e) => e.exercise_id)
    .filter((id): id is string => id !== null && id !== undefined);

  const exerciseNamesMap = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const exerciseRows = (await trx("exercises")
      .whereIn("id", exerciseIds)
      .select("id", "name")) as Array<{ id: string; name: string }>;

    for (const row of exerciseRows) {
      exerciseNamesMap.set(row.id, row.name);
    }
  }

  await trx("session_exercises").insert(
    exercises.map((exercise) => ({
      id: exercise.id,
      session_id: sessionId,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_id
        ? (exerciseNamesMap.get(exercise.exercise_id) ?? null)
        : null,
      order_index: exercise.order_index,
      notes: exercise.notes,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );

  const plannedRows = exercises
    .map((exercise) => {
      const planned = buildAttributes(exercise.planned);
      if (!planned) {
        return null;
      }
      return {
        session_exercise_id: exercise.id,
        sets: planned.sets,
        reps: planned.reps,
        load: planned.load,
        distance: planned.distance,
        duration: planned.duration,
        rpe: planned.rpe,
        rest: planned.rest,
        extras: planned.extras ?? {},
        created_at: timestamp,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (plannedRows.length) {
    await trx("planned_exercise_attributes").insert(plannedRows);
  }

  const setRows = exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      id: set.id,
      session_exercise_id: exercise.id,
      order_index: set.order_index,
      reps: set.reps ?? null,
      weight_kg: set.weight_kg ?? null,
      distance_m: set.distance_m ?? null,
      duration_sec: set.duration_sec ?? null,
      rpe: set.rpe ?? null,
      rest_sec: set.rest_sec ?? null,
      extras: set.extras ?? {},
      recorded_at: set.recorded_at ?? null,
      notes: set.notes ?? null,
      created_at: timestamp,
    })),
  );

  if (setRows.length) {
    await trx("exercise_sets").insert(setRows);
  }
}

export async function listSessionSets(sessionId: string, trx?: Knex.Transaction) {
  return executor(trx)("exercise_sets as s")
    .leftJoin("session_exercises as se", "se.id", "s.session_exercise_id")
    .leftJoin("exercises as e", "e.id", "se.exercise_id")
    .select(
      "s.id",
      "e.id as exercise_id",
      "e.name as exercise_name",
      "e.type_code",
      "s.order_index",
      "s.reps",
      "s.weight_kg",
      "s.distance_m",
      "s.duration_sec",
      "s.rpe",
      "s.rest_sec",
      "s.extras",
      "s.recorded_at",
      "s.notes",
    )
    .where("se.session_id", sessionId)
    .orderBy([
      { column: "se.order_index", order: "asc" },
      { column: "s.order_index", order: "asc" },
    ]);
}

/**
 * Returns completed strength work by body region for service-layer weighting.
 * Core and unknown muscle groups are intentionally neutral. Full-body work is
 * kept separate so the consuming calculation can allocate it explicitly.
 */
export async function listRegionalStrengthStimuli(
  userId: string,
  window: RegionalTrainingLoadWindow,
  trx?: Knex.Transaction,
): Promise<RegionalStrengthStimulus[]> {
  const result = await executor(trx).raw<{
    rows: Array<{
      region: "upper" | "lower" | "fullBody";
      completed_at: string | Date;
      set_count: number | string;
      average_rpe: number | string | null;
    }>;
  }>(
    `
      SELECT
        CASE
          WHEN LOWER(TRIM(e.muscle_group)) IN ('chest', 'back', 'shoulders', 'arms')
            THEN 'upper'
          WHEN LOWER(TRIM(e.muscle_group)) = 'legs'
            THEN 'lower'
          WHEN LOWER(TRIM(e.muscle_group)) = 'full_body'
            THEN 'fullBody'
        END AS region,
        s.completed_at,
        GREATEST(COUNT(es.id), 1) AS set_count,
        AVG(es.rpe) FILTER (WHERE es.rpe BETWEEN 1 AND 10) AS average_rpe
      FROM sessions s
      INNER JOIN session_exercises se ON se.session_id = s.id
      INNER JOIN exercises e ON e.id = se.exercise_id
      LEFT JOIN exercise_sets es ON es.session_exercise_id = se.id
      WHERE s.owner_id = ?
        AND s.status = 'completed'
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
        AND s.completed_at BETWEEN ? AND ?
        AND e.type_code = 'strength'
        AND LOWER(TRIM(e.muscle_group)) IN (
          'chest', 'back', 'shoulders', 'arms', 'legs', 'full_body'
        )
      GROUP BY se.id, e.muscle_group, s.completed_at
    `,
    [userId, window.from, window.to],
  );

  return (result.rows ?? []).map((row) => ({
    region: row.region,
    completedAt:
      row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
    setCount: Number(row.set_count),
    averageRpe: row.average_rpe === null ? null : Number(row.average_rpe),
  }));
}

export async function listCompletedSessionIdsForGamification(
  userId: string,
  trx?: Knex.Transaction,
): Promise<string[]> {
  const rows = await executor(trx)("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .whereNotNull("completed_at")
    .orderBy("completed_at", "asc")
    .orderBy("id", "asc")
    .select<Array<{ id: string }>>("id");
  return rows.map((row) => row.id);
}

export async function clearCompletedSessionGamificationRebuildFlags(
  userId: string,
  trx?: Knex.Transaction,
): Promise<void> {
  await executor(trx)("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNull("deleted_at")
    .update({
      gamification_rebuild_required: false,
      updated_at: new Date().toISOString(),
    });
}
