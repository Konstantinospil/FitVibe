import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../utils/http.js";
import type { SessionExerciseUpsertInput } from "./sessions.repository.js";
import type {
  SessionExercise,
  SessionExerciseActualInput,
  SessionExerciseAttributesInput,
  SessionExerciseInput,
  SessionExerciseSet,
  SessionSetInput,
  SessionSetPlannedValues,
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

/** Bounds of a set's heart rate (issue 89): they refuse typing errors, not unusual athletes. */
export const HEART_RATE_LIMITS = { min: 20, max: 250 } as const;

export function normalizeHeartRate(
  value: number | null | undefined,
  context: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < HEART_RATE_LIMITS.min || value > HEART_RATE_LIMITS.max) {
    throw new HttpError(
      422,
      "E.SESSION.INVALID_SET",
      `${context}: heart_rate_bpm must be a whole number from ${HEART_RATE_LIMITS.min} to ${HEART_RATE_LIMITS.max}`,
    );
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

export type SetMetricValues = Required<{ [K in keyof SessionSetPlannedValues]: number | null }>;

export const EMPTY_SET_METRICS: SetMetricValues = {
  reps: null,
  weight_kg: null,
  distance_m: null,
  duration_sec: null,
  rpe: null,
  rest_sec: null,
};

export function normalizeSetMetrics(
  values: SessionSetPlannedValues | null | undefined,
  context: string,
): SetMetricValues {
  return {
    reps: ensureNonNegativeInteger("reps", values?.reps ?? null, context),
    weight_kg: ensureNonNegativeNumber("weight_kg", values?.weight_kg ?? null, context),
    distance_m: ensureNonNegativeInteger("distance_m", values?.distance_m ?? null, context),
    duration_sec: ensureNonNegativeInteger("duration_sec", values?.duration_sec ?? null, context),
    rpe: ensureRpeRange("rpe", values?.rpe ?? null, context),
    rest_sec: ensureNonNegativeInteger("rest_sec", values?.rest_sec ?? null, context),
  };
}

export function hasMetricValue(values: SetMetricValues): boolean {
  return Object.values(values).some((value) => value !== null);
}

function performedValuesOf(set: SessionSetInput | SessionExerciseSet): SessionSetPlannedValues {
  return {
    reps: set.reps,
    weight_kg: set.weight_kg,
    distance_m: set.distance_m,
    duration_sec: set.duration_sec,
    rpe: set.rpe,
    rest_sec: set.rest_sec,
  };
}

/**
 * ADR-042: the top-level set fields hold performed values; `planned` holds the
 * prescription; only `completed` sets are performed work.
 *
 * Compatibility (ADR-029): a planned set that carries values only in the
 * top-level fields is how clients wrote prescriptions before ADR-042. Those
 * values are converted to the prescription. Remove this conversion once every
 * client sends `planned` for planned sets.
 */
function normalizeSet(set: SessionSetInput, order: number, setContext: string) {
  const status = set.status ?? (set.recorded_at ? "completed" : "planned");
  let performed = normalizeSetMetrics(performedValuesOf(set), setContext);
  let planned = set.planned ? normalizeSetMetrics(set.planned, `${setContext} planned`) : null;
  // A result only, with no prescription twin: only completed sets carry one.
  const heartRate = normalizeHeartRate(set.heart_rate_bpm, setContext);
  if (heartRate !== null && status !== "completed") {
    throw new HttpError(
      422,
      "E.SESSION.INVALID_SET",
      `${setContext}: only a completed set can have heart_rate_bpm`,
    );
  }

  if (status === "planned") {
    if (set.recorded_at) {
      throw new HttpError(
        422,
        "E.SESSION.INVALID_SET",
        `${setContext}: a planned set cannot have recorded_at`,
      );
    }
    if (hasMetricValue(performed)) {
      if (planned && hasMetricValue(planned)) {
        throw new HttpError(
          422,
          "E.SESSION.INVALID_SET",
          `${setContext}: a planned set holds targets in planned only`,
        );
      }
      planned = performed;
      performed = { ...EMPTY_SET_METRICS };
    }
  }
  if (status === "skipped" && hasMetricValue(performed)) {
    throw new HttpError(
      422,
      "E.SESSION.INVALID_SET",
      `${setContext}: a skipped set cannot have performed values`,
    );
  }

  return {
    id: set.id ?? uuidv4(),
    order_index: order,
    status,
    source: set.source ?? "prescribed",
    planned: planned && hasMetricValue(planned) ? planned : null,
    ...performed,
    heart_rate_bpm: heartRate,
    extras: normalizeExtras(set.extras),
    recorded_at: set.recorded_at ? new Date(set.recorded_at).toISOString() : null,
    notes: trimToNull(set.notes),
  };
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

    return normalizeSet(set, order, setContext);
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
          status: "completed" as const,
          source: "prescribed" as const,
          planned: null,
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
      status: exercise.status ?? "planned",
      source: exercise.source ?? "prescribed",
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
    // A reused workout starts from scratch; a full copy keeps how it went.
    ...(includeActual ? { status: exercise.status, source: exercise.source } : {}),
    notes: exercise.notes ?? undefined,
    planned: exercise.planned ?? undefined,
    actual: null,
    sets: (exercise.sets ?? [])
      .filter((set) => includeActual || set.status !== "skipped")
      .map((set, index) =>
        includeActual
          ? {
              order: set.order_index,
              status: set.status,
              source: set.source,
              planned: set.planned ? { ...set.planned } : null,
              reps: set.reps ?? undefined,
              weight_kg: set.weight_kg ?? undefined,
              distance_m: set.distance_m ?? undefined,
              duration_sec: set.duration_sec ?? undefined,
              rpe: set.rpe ?? undefined,
              rest_sec: set.rest_sec ?? undefined,
              heart_rate_bpm: set.heart_rate_bpm ?? undefined,
              extras: set.extras ? { ...set.extras } : undefined,
              recorded_at: set.recorded_at ?? undefined,
              notes: set.notes ?? undefined,
            }
          : {
              // Reuse as a prescription: the original target, or what was done
              // when no target was recorded (ADR-042).
              order: index + 1,
              status: "planned" as const,
              source: "prescribed" as const,
              planned: set.planned ?? (set.status === "completed" ? performedValuesOf(set) : null),
            },
      ),
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
