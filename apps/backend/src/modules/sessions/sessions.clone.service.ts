import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { recomputeProgress } from "../plans/plans.service.js";
import {
  createSession,
  getSessionWithDetails,
  refreshSessionSummary,
  replaceSessionExercises,
  sessionsExistAtDates,
} from "./sessions.repository.js";
import type {
  CloneSessionDTO,
  Session,
  SessionRecurrenceDTO,
  SessionWithExercises,
} from "./sessions.types.js";
import {
  cloneExerciseInputsForReuse,
  convertExistingExerciseToInput,
  ensurePlanExists,
  normalizeSessionExercises,
  trimToNull,
} from "./sessions.normalization.js";

export async function cloneOne(
  userId: string,
  sourceId: string,
  dto: CloneSessionDTO,
): Promise<SessionWithExercises> {
  const source = await getSessionWithDetails(sourceId, userId);
  if (!source) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }

  const includeActual = dto.include_actual ?? false;
  const targetPlanId = dto.plan_id !== undefined ? (dto.plan_id ?? null) : (source.plan_id ?? null);
  const planChanged = targetPlanId !== (source.plan_id ?? null);

  const normalizedExercises = normalizeSessionExercises(
    source.exercises.map((exercise) => convertExistingExerciseToInput(exercise, includeActual)),
  );

  let plannedAt: string;
  if (dto.planned_at) {
    plannedAt = new Date(dto.planned_at).toISOString();
  } else if (dto.date_offset_days !== undefined) {
    const base = new Date(source.planned_at);
    base.setUTCDate(base.getUTCDate() + dto.date_offset_days);
    plannedAt = base.toISOString();
  } else {
    plannedAt = new Date(source.planned_at).toISOString();
  }

  const sessionId = uuidv4();
  const timestamp = new Date().toISOString();
  const row: Session = {
    id: sessionId,
    owner_id: userId,
    plan_id: targetPlanId ?? null,
    title: dto.title !== undefined ? trimToNull(dto.title) : trimToNull(source.title ?? null),
    planned_at: plannedAt,
    status: "planned",
    visibility: dto.visibility ?? source.visibility ?? "private",
    notes: dto.notes !== undefined ? trimToNull(dto.notes) : trimToNull(source.notes ?? null),
    recurrence_rule:
      dto.recurrence_rule !== undefined
        ? trimToNull(dto.recurrence_rule)
        : trimToNull(source.recurrence_rule ?? null),
    created_at: timestamp,
    updated_at: timestamp,
  };

  await db.transaction(async (trx) => {
    if (planChanged && targetPlanId) {
      await ensurePlanExists(trx, targetPlanId, userId);
    }

    await createSession(row, trx);
    if (normalizedExercises.length > 0) {
      await replaceSessionExercises(trx, sessionId, normalizedExercises);
    }
  });

  const cloned = await getSessionWithDetails(sessionId, userId);
  if (!cloned) {
    throw new HttpError(500, "E.SESSION.CLONE_FAILED", "SESSION_CLONE_FAILED");
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "clone",
    entityId: sessionId,
    metadata: {
      source_id: sourceId,
      plan_id: cloned.plan_id,
      include_actual: includeActual,
    },
  });

  if (cloned.plan_id) {
    await recomputeProgress(userId, cloned.plan_id);
  }

  if (normalizedExercises.length > 0) {
    await refreshSessionSummary();
  }

  return cloned;
}

function addDays(base: Date, days: number): Date {
  const clone = new Date(base.getTime());
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

export async function applyRecurrence(
  userId: string,
  sourceId: string,
  dto: SessionRecurrenceDTO,
): Promise<SessionWithExercises[]> {
  if (!Number.isInteger(dto.occurrences) || dto.occurrences < 1 || dto.occurrences > 52) {
    throw new HttpError(
      400,
      "E.SESSION.RECURRENCE_INVALID",
      "occurrences must be between 1 and 52",
    );
  }

  if (!Number.isInteger(dto.offset_days) || dto.offset_days < 1 || dto.offset_days > 180) {
    throw new HttpError(
      400,
      "E.SESSION.RECURRENCE_INVALID",
      "offset_days must be between 1 and 180",
    );
  }

  if (dto.offset_days * dto.occurrences > 365) {
    throw new HttpError(400, "E.SESSION.RECURRENCE_INVALID", "SESSION_RECURRENCE_INVALID");
  }

  const source = await getSessionWithDetails(sourceId, userId);
  if (!source) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  if (source.status === "canceled") {
    throw new HttpError(400, "E.SESSION.RECURRENCE_SOURCE_INVALID", "SESSION_INVALID_SOURCE");
  }

  const includeActual = dto.include_actual ?? false;
  const targetPlanId = dto.plan_id !== undefined ? (dto.plan_id ?? null) : (source.plan_id ?? null);

  const baseExercisesInput = source.exercises
    ? source.exercises.map((exercise) => convertExistingExerciseToInput(exercise, includeActual))
    : [];

  const baseDate = new Date(source.planned_at);
  if (Number.isNaN(baseDate.getTime())) {
    throw new HttpError(500, "E.SESSION.INVALID_SOURCE", "SESSION_INVALID_SOURCE");
  }

  let startDate: Date | null = null;
  if (dto.start_from) {
    startDate = new Date(dto.start_from);
    if (Number.isNaN(startDate.getTime())) {
      throw new HttpError(
        400,
        "E.SESSION.RECURRENCE_INVALID_START",
        "start_from must be a valid date",
      );
    }
  }

  const plannedDates: string[] = [];
  for (let index = 0; index < dto.occurrences; index += 1) {
    const reference = startDate ? startDate : baseDate;
    const increment = startDate ? dto.offset_days * index : dto.offset_days * (index + 1);
    const target = addDays(reference, increment);
    plannedDates.push(target.toISOString());
  }

  const baseIso = baseDate.toISOString();
  if (plannedDates.includes(baseIso)) {
    throw new HttpError(
      400,
      "E.SESSION.RECURRENCE_INVALID_START",
      "Recurrence would duplicate the source session date",
    );
  }

  const conflicts = await sessionsExistAtDates(userId, plannedDates);
  if (conflicts.length > 0) {
    throw new HttpError(
      409,
      "E.SESSION.RECURRENCE_CONFLICT",
      "A session already exists for one or more target dates",
      { conflicts },
    );
  }

  const createdSessionIds: string[] = [];
  const timestamp = new Date().toISOString();

  await db.transaction(async (trx) => {
    if (targetPlanId) {
      await ensurePlanExists(trx, targetPlanId, userId);
    }

    for (const plannedAt of plannedDates) {
      const sessionId = uuidv4();
      const row: Session = {
        id: sessionId,
        owner_id: userId,
        plan_id: targetPlanId ?? null,
        title: dto.title !== undefined ? trimToNull(dto.title) : trimToNull(source.title ?? null),
        planned_at: plannedAt,
        status: "planned",
        visibility: dto.visibility ?? source.visibility ?? "private",
        notes: dto.notes !== undefined ? trimToNull(dto.notes) : trimToNull(source.notes ?? null),
        recurrence_rule:
          dto.recurrence_rule !== undefined
            ? trimToNull(dto.recurrence_rule)
            : trimToNull(source.recurrence_rule ?? null),
        created_at: timestamp,
        updated_at: timestamp,
      };

      await createSession(row, trx);

      if (baseExercisesInput.length > 0) {
        const normalized = normalizeSessionExercises(
          cloneExerciseInputsForReuse(baseExercisesInput),
        );
        if (normalized.length > 0) {
          await replaceSessionExercises(trx, sessionId, normalized);
        }
      }

      createdSessionIds.push(sessionId);
    }
  });

  const clones: SessionWithExercises[] = [];
  for (const id of createdSessionIds) {
    const clone = await getSessionWithDetails(id, userId);
    if (!clone) {
      throw new HttpError(
        500,
        "E.SESSION.RECURRENCE_LOAD_FAILED",
        "Unable to load created recurrence session",
      );
    }
    clones.push(clone);
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "recurrence_create",
    entityId: sourceId,
    metadata: {
      occurrences: dto.occurrences,
      offset_days: dto.offset_days,
      planned_dates: plannedDates,
      include_actual: includeActual,
      plan_id: targetPlanId,
    },
  });

  if (targetPlanId) {
    await recomputeProgress(userId, targetPlanId);
  }

  await refreshSessionSummary();

  return clones;
}
