import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../utils/http.js";
import type { SessionExerciseUpsertInput } from "./sessions.repository.js";
import type {
  SessionExercise,
  SessionExerciseActualInput,
  SessionExerciseAttributesInput,
  SessionExerciseInput,
} from "./sessions.types.js";

const intervalPattern =
  /^(?:P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?|(?:\d{2}):(?:\d{2})(?::(?:\d{2}))?)$/;

export function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function ensureNonNegativeNumber(
  name: string,
  value: number | null | undefined,
  context: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Number.isNaN(value) || value < 0) {
    throw new HttpError(422, "E.SESSION.INVALID_SET", `${context}: ${name} cannot be negative`);
  }
  return value;
}

export function ensureNonNegativeInteger(
  name: string,
  value: number | null | undefined,
  context: string,
): number | null {
  const normalized = ensureNonNegativeNumber(name, value, context);
  if (normalized === null) {
    return null;
  }
  if (!Number.isInteger(normalized)) {
    throw new HttpError(422, "E.SESSION.INVALID_SET", `${context}: ${name} must be an integer`);
  }
  return normalized;
}

function ensureRpeRange(
  name: string,
  value: number | null | undefined,
  context: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new HttpError(422, "E.SESSION.INVALID_SET", `${context}: ${name} must be 1-10`);
  }
  return value;
}

function validateInterval(
  name: string,
  value: string | null | undefined,
  context: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!intervalPattern.test(value)) {
    throw new HttpError(
      422,
      "E.SESSION.INVALID_SET",
      `${context}: ${name} must be ISO 8601 duration or HH:MM[:SS]`,
    );
  }
  return value;
}

function normalizeExtras(extras: unknown): Record<string, unknown> {
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) {
    return {};
  }
  return extras as Record<string, unknown>;
}

type PlanRow = { id: string; user_id: string };

export async function ensurePlanExists(
  trx: Knex.Transaction,
  planId: string,
  ownerId: string,
): Promise<void> {
  const plan = await trx<PlanRow>("plans")
    .select("id")
    .where({ id: planId, user_id: ownerId })
    .first();
  if (!plan) {
    throw new HttpError(400, "E.SESSION.INVALID_PLAN", "SESSION_INVALID_PLAN");
  }
}

function normalizeAttributesInput(
  input: SessionExerciseAttributesInput | null | undefined,
  context: string,
) {
  if (!input) {
    return null;
  }

  const normalized = {
    sets: ensureNonNegativeInteger("sets", input.sets, context),
    reps: ensureNonNegativeInteger("reps", input.reps, context),
    load: ensureNonNegativeNumber("load", input.load, context),
    distance: ensureNonNegativeNumber("distance", input.distance, context),
    duration: validateInterval("duration", input.duration ?? null, context),
    rpe: ensureRpeRange("rpe", input.rpe, context),
    rest: validateInterval("rest", input.rest ?? null, context),
    extras: normalizeExtras(input.extras),
  };

  const hasValue =
    normalized.sets !== null ||
    normalized.reps !== null ||
    normalized.load !== null ||
    normalized.distance !== null ||
    (normalized.duration && normalized.duration.length > 0) ||
    normalized.rpe !== null ||
    (normalized.rest && normalized.rest.length > 0) ||
    Object.keys(normalized.extras).length > 0;

  return hasValue ? normalized : null;
}

function normalizeActualAttributesInput(
  input: SessionExerciseActualInput | null | undefined,
  context: string,
) {
  const base = normalizeAttributesInput(input, context);
  if (!base) {
    return null;
  }
  const recordedAt =
    input?.recorded_at && input.recorded_at.length
      ? new Date(input.recorded_at).toISOString()
      : null;
  return {
    ...base,
    recorded_at: recordedAt,
  };
}

function intervalToSeconds(value: string | null, context: string, field: string): number | null {
  if (!value) {
    return null;
  }
  const clock = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
  }

  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!iso) {
    throw new HttpError(
      422,
      "E.SESSION.LEGACY_ACTUAL_UNCONVERTIBLE",
      `${context}: ${field} cannot be converted losslessly to seconds`,
    );
  }
  return (
    Number(iso[1] ?? 0) * 86400 +
    Number(iso[2] ?? 0) * 3600 +
    Number(iso[3] ?? 0) * 60 +
    Number(iso[4] ?? 0)
  );
}

function normalizeSets(
  sets: SessionExerciseInput["sets"],
  context: string,
): SessionExerciseUpsertInput["sets"] {
  if (!sets || sets.length === 0) {
    return [];
  }
  const seenOrders = new Set<number>();

  const normalized = sets.map((set, index) => {
    const setContext = `${context} set #${index + 1}`;
    const order = ensureNonNegativeInteger("order", set.order, setContext);
    if (order === null || order < 1) {
      throw new HttpError(422, "E.SESSION.INVALID_SET", `${setContext}: order must be >= 1`);
    }
    if (seenOrders.has(order)) {
      throw new HttpError(422, "E.SESSION.INVALID_SET", `${context}: duplicate set order ${order}`);
    }
    seenOrders.add(order);

    return {
      id: set.id ?? uuidv4(),
      order_index: order,
      reps: ensureNonNegativeInteger("reps", set.reps ?? null, setContext),
      weight_kg: ensureNonNegativeNumber("weight_kg", set.weight_kg ?? null, setContext),
      distance_m: ensureNonNegativeInteger("distance_m", set.distance_m ?? null, setContext),
      duration_sec: ensureNonNegativeInteger("duration_sec", set.duration_sec ?? null, setContext),
      rpe: ensureRpeRange("rpe", set.rpe ?? null, setContext),
      rest_sec: ensureNonNegativeInteger("rest_sec", set.rest_sec ?? null, setContext),
      extras: normalizeExtras(set.extras),
      recorded_at: set.recorded_at ? new Date(set.recorded_at).toISOString() : null,
      notes: trimToNull(set.notes),
    };
  });

  normalized.sort((a, b) => a.order_index - b.order_index);
  return normalized;
}

export function normalizeSessionExercises(
  exercises?: SessionExerciseInput[],
): SessionExerciseUpsertInput[] {
  if (!exercises || exercises.length === 0) {
    return [];
  }

  const seenOrders = new Set<number>();

  const normalized = exercises.map((exercise, index) => {
    const context = `exercise #${index + 1}`;
    const order = ensureNonNegativeInteger("order", exercise.order, context);
    if (order === null || order < 1) {
      throw new HttpError(422, "E.SESSION.INVALID_SET", `${context}: order must be >= 1`);
    }
    if (seenOrders.has(order)) {
      throw new HttpError(422, "E.SESSION.INVALID_SET", `Duplicate exercise order ${order}`);
    }
    seenOrders.add(order);

    const actual = normalizeActualAttributesInput(exercise.actual ?? null, `${context} actual`);
    const explicitSets = normalizeSets(exercise.sets, context);

    if (actual && explicitSets.length > 0) {
      throw new HttpError(
        422,
        "E.SESSION.AMBIGUOUS_ACTUAL",
        `${context}: provide either legacy actual attributes or explicit sets, not both`,
      );
    }

    const performedSets: SessionExerciseUpsertInput["sets"] = actual
      ? Array.from({ length: actual.sets && actual.sets > 0 ? actual.sets : 1 }, (_, setIndex) => ({
          id: uuidv4(),
          order_index: setIndex + 1,
          reps: actual.reps,
          weight_kg: actual.load,
          distance_m:
            setIndex === 0 && actual.distance !== null ? Math.round(actual.distance * 1000) : null,
          duration_sec:
            setIndex === 0 ? intervalToSeconds(actual.duration, context, "actual.duration") : null,
          rpe: setIndex === 0 ? actual.rpe : null,
          rest_sec: setIndex === 0 ? intervalToSeconds(actual.rest, context, "actual.rest") : null,
          extras: setIndex === 0 ? actual.extras : {},
          recorded_at: setIndex === 0 ? actual.recorded_at : null,
          notes: null,
        }))
      : explicitSets;

    return {
      id: exercise.id ?? uuidv4(),
      exercise_id: exercise.exercise_id ?? null,
      order_index: order,
      notes: trimToNull(exercise.notes),
      planned: normalizeAttributesInput(exercise.planned ?? null, `${context} planned`),
      sets: performedSets,
    };
  });

  normalized.sort((a, b) => a.order_index - b.order_index);
  return normalized;
}

export function convertExistingExerciseToInput(
  exercise: SessionExercise,
  includeActual: boolean,
): SessionExerciseInput {
  return {
    order: exercise.order_index,
    exercise_id: exercise.exercise_id ?? undefined,
    notes: exercise.notes ?? undefined,
    planned: exercise.planned ?? undefined,
    actual: null,
    sets: includeActual
      ? (exercise.sets?.map((set) => ({
          order: set.order_index,
          reps: set.reps ?? undefined,
          weight_kg: set.weight_kg ?? undefined,
          distance_m: set.distance_m ?? undefined,
          duration_sec: set.duration_sec ?? undefined,
          rpe: set.rpe ?? undefined,
          rest_sec: set.rest_sec ?? undefined,
          extras: set.extras ? { ...set.extras } : undefined,
          recorded_at: set.recorded_at ?? undefined,
          notes: set.notes ?? undefined,
        })) ?? [])
      : [],
  };
}

export function cloneExerciseInputsForReuse(
  inputs: SessionExerciseInput[],
): SessionExerciseInput[] {
  return inputs.map((exercise) => ({
    ...exercise,
    sets: exercise.sets
      ? exercise.sets.map((set) => ({
          ...set,
        }))
      : undefined,
    planned: exercise.planned
      ? {
          ...exercise.planned,
          extras: exercise.planned.extras ? { ...exercise.planned.extras } : undefined,
        }
      : undefined,
    actual: exercise.actual
      ? {
          ...exercise.actual,
          extras: exercise.actual.extras ? { ...exercise.actual.extras } : undefined,
        }
      : exercise.actual,
  }));
}
