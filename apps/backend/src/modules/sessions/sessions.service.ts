import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import {
  findOverlappingSessions,
  listSessions,
  getSessionById,
  getSessionWithDetails,
  createSession,
  updateSession,
  cancelSession,
  replaceSessionExercises,
  refreshSessionSummary,
} from "./sessions.repository.js";
import type {
  CreateSessionDTO,
  UpdateSessionDTO,
  Session,
  SessionListItem,
  SessionQuery,
  PaginatedResult,
  SessionVibeChanges,
  SessionWithExercises,
} from "./sessions.types";
import { recomputeProgress } from "../plans/plans.service.js";
import { insertAudit } from "../common/audit.util.js";
import { HttpError } from "../../utils/http.js";
import { reconcileSessionPublication } from "../feed/feed.publication.service.js";
import {
  markGamificationStale,
  scheduleGamificationReconciliation,
} from "../points/gamification-projection.service.js";
import { ensureSessionInteractionAllowed, loadSessionOrThrow } from "../feed/feed.access.js";
import {
  ensureNonNegativeInteger,
  ensurePlanExists,
  normalizeSessionExercises,
  trimToNull,
} from "./sessions.normalization.js";
import { DEFAULT_SESSION_DURATION_MIN, type ScheduleWindow } from "./sessions.schedule.js";
import { closedPause } from "./sessions.execution.service.js";
import { listActiveSessionVibeChanges } from "../points/vibe-level.repository.js";

/**
 * Server-side re-validation for rescheduling and resizing (US-4.3-AC03). Clients
 * detect the same overlap before saving; the server stays authoritative.
 */
async function ensureScheduleSlotFree(
  userId: string,
  sessionId: string,
  window: ScheduleWindow,
  trx: Knex.Transaction,
): Promise<void> {
  const conflicts = await findOverlappingSessions(
    userId,
    [window],
    { excludeSessionId: sessionId },
    trx,
  );
  if (conflicts.length > 0) {
    throw new HttpError(
      422,
      "E.SESSION.SCHEDULE_CONFLICT",
      "Another session is planned during this time",
      { conflictingSessionIds: conflicts.map((conflict) => conflict.id) },
    );
  }
}

const allowedTransitions: Record<string, string[]> = {
  planned: ["in_progress", "completed", "canceled"],
  in_progress: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export async function getAll(
  userId: string,
  query: SessionQuery,
): Promise<PaginatedResult<SessionListItem>> {
  return listSessions(userId, query);
}

export async function getOne(userId: string, id: string): Promise<SessionWithExercises> {
  const accessSession = await loadSessionOrThrow(id);
  await ensureSessionInteractionAllowed(userId, accessSession);

  const session = await getSessionWithDetails(id, accessSession.owner_id);
  if (!session) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  // The workout photo is personal (ADR-044): a public session is shown without it.
  return session.owner_id === userId ? session : { ...session, photo: null };
}

/**
 * The Vibe level changes a session caused (issue 289). They are personal, so only
 * the owner sees them; anyone else gets the same 404 as for a missing session.
 * The list is empty until the session is completed and its points are processed.
 */
export async function getSessionVibeChanges(
  userId: string,
  id: string,
): Promise<SessionVibeChanges> {
  // Scoped to the owner and to sessions not deleted, so a missing session and
  // someone else's answer the same way.
  if (!(await getSessionById(id, userId))) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  const changes = await listActiveSessionVibeChanges(userId, id);
  return {
    session_id: id,
    changes: changes.map((change) => ({
      domain_code: change.domain_code,
      previous_level: change.old_vibe_level,
      new_level: change.new_vibe_level,
      change: change.change_amount,
    })),
  };
}

/**
 * A logged workout (manual Log, ADR-042) started at its planned time and lasted
 * its planned length, but it cannot end in the future.
 */
function resultNoteWithoutResult(): HttpError {
  return new HttpError(
    400,
    "E.SESSION.RESULT_NOTE_WITHOUT_RESULT",
    "result_note is only accepted for a completed session",
  );
}

function loggedWorkoutTimes(plannedAt: string, durationMin: number, now: Date) {
  const start = new Date(plannedAt);
  if (start.getTime() > now.getTime()) {
    throw new HttpError(
      422,
      "E.SESSION.LOG_IN_FUTURE",
      "A logged workout must have started in the past",
    );
  }
  const end = Math.min(start.getTime() + durationMin * 60_000, now.getTime());
  return { started_at: start.toISOString(), completed_at: new Date(end).toISOString() };
}

export async function createOne(
  userId: string,
  dto: CreateSessionDTO,
): Promise<SessionWithExercises> {
  const normalizedExercises = normalizeSessionExercises(dto.exercises);
  const sessionId = uuidv4();
  const now = new Date();
  const timestamp = now.toISOString();
  const logging = dto.status === "completed";
  if (dto.completion_outcome !== undefined && !logging) {
    throw new HttpError(
      400,
      "E.SESSION.OUTCOME_WITHOUT_COMPLETION",
      "completion_outcome is only accepted for a completed session",
    );
  }
  if (dto.result_note !== undefined && !logging) {
    throw resultNoteWithoutResult();
  }
  const plannedAt = new Date(dto.planned_at).toISOString();
  const plannedDurationMin = dto.planned_duration_min ?? DEFAULT_SESSION_DURATION_MIN;

  const row: Session = {
    id: sessionId,
    owner_id: userId,
    plan_id: dto.plan_id ?? null,
    title: trimToNull(dto.title),
    planned_at: plannedAt,
    planned_duration_min: plannedDurationMin,
    status: logging ? "completed" : "planned",
    visibility: dto.visibility ?? "private",
    notes: trimToNull(dto.notes),
    result_note: logging ? trimToNull(dto.result_note) : null,
    recurrence_rule: trimToNull(dto.recurrence_rule),
    ...(logging
      ? {
          ...loggedWorkoutTimes(plannedAt, plannedDurationMin, now),
          completion_outcome: dto.completion_outcome ?? "completed",
        }
      : {}),
    created_at: timestamp,
    updated_at: timestamp,
  };

  await db.transaction(async (trx) => {
    if (row.plan_id) {
      await ensurePlanExists(trx, row.plan_id, userId);
    }

    await createSession(row, trx);
    if (normalizedExercises.length > 0) {
      await replaceSessionExercises(trx, sessionId, normalizedExercises);
    }
    if (logging) {
      await markGamificationStale(userId, false, trx);
    }
  });

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "create",
    entityId: sessionId,
    metadata: {
      title: row.title,
      plan_id: row.plan_id,
      planned_at: row.planned_at,
      visibility: row.visibility,
      recurrence_rule: row.recurrence_rule,
      exercise_count: normalizedExercises.length,
      status: row.status,
      completion_outcome: row.completion_outcome ?? null,
    },
  });

  if (row.plan_id) {
    await recomputeProgress(userId, row.plan_id);
  }

  const created = await getSessionWithDetails(sessionId, userId);
  if (!created) {
    throw new HttpError(500, "E.SESSION.CREATE_FAILED", "SESSION_CREATE_FAILED", {
      sessionId,
      userId,
    });
  }

  if (normalizedExercises.length > 0 || created.status === "completed") {
    await refreshSessionSummary();
  }

  if (logging) {
    await reconcileSessionPublication(userId, sessionId, created.status, created.visibility);
    scheduleGamificationReconciliation(userId, sessionId, false);
  }

  return created;
}

export async function updateOne(
  userId: string,
  id: string,
  dto: UpdateSessionDTO,
): Promise<SessionWithExercises> {
  const current = await getSessionById(id, userId);
  if (!current) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }

  const correctionFieldsTouched =
    dto.plan_id !== undefined ||
    dto.planned_at !== undefined ||
    dto.planned_duration_min !== undefined ||
    dto.started_at !== undefined ||
    dto.completed_at !== undefined ||
    dto.calories !== undefined ||
    dto.exercises !== undefined;

  if (current.status === "completed" && correctionFieldsTouched) {
    throw new HttpError(
      409,
      "E.SESSION.REOPEN_REQUIRED",
      "Completed workout records must be reopened before correction.",
    );
  }

  const normalizedExercises = dto.exercises ? normalizeSessionExercises(dto.exercises) : null;

  const targetStatus = dto.status;
  if (
    dto.completion_outcome !== undefined &&
    !(targetStatus === "completed" && current.status !== "completed")
  ) {
    throw new HttpError(
      400,
      "E.SESSION.OUTCOME_WITHOUT_COMPLETION",
      "completion_outcome is only accepted when the session is completed",
    );
  }
  // The note describes a result, so the session must be, or become, completed.
  if (dto.result_note !== undefined && (targetStatus ?? current.status) !== "completed") {
    throw resultNoteWithoutResult();
  }
  let targetStartedAt = dto.started_at;
  let targetCompletedAt = dto.completed_at;
  let targetDeletedAt: string | null | undefined;
  const updates: Partial<Session> = {
    updated_at: new Date().toISOString(),
  };

  if (targetStatus && targetStatus !== current.status) {
    const allowed = allowedTransitions[current.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new HttpError(
        400,
        "E.SESSION.INVALID_STATUS",
        `Invalid status transition: ${current.status} -> ${targetStatus}`,
      );
    }

    const nowIso = new Date().toISOString();
    if (targetStatus === "in_progress" && !targetStartedAt) {
      targetStartedAt = nowIso;
    }
    if (targetStatus === "completed" && !targetCompletedAt) {
      targetCompletedAt = nowIso;
    }
    if (targetStatus === "completed") {
      updates.completion_outcome = dto.completion_outcome ?? "completed";
      // Finishing while paused ends the pause (ADR-043).
      if (current.paused_at) {
        Object.assign(updates, closedPause(current, new Date()));
      }
    }
    if (targetStatus === "canceled") {
      targetDeletedAt = nowIso;
    }
  }

  if (dto.plan_id !== undefined) {
    updates.plan_id = dto.plan_id ?? null;
  }
  if (dto.title !== undefined) {
    updates.title = trimToNull(dto.title);
  }
  if (dto.planned_at) {
    updates.planned_at = new Date(dto.planned_at).toISOString();
  }
  if (dto.planned_duration_min !== undefined) {
    updates.planned_duration_min = dto.planned_duration_min;
  }
  if (targetStatus) {
    updates.status = targetStatus;
  }
  if (dto.visibility) {
    updates.visibility = dto.visibility;
  }
  if (dto.notes !== undefined) {
    updates.notes = trimToNull(dto.notes);
  }
  if (dto.result_note !== undefined) {
    updates.result_note = trimToNull(dto.result_note);
  }
  if (dto.recurrence_rule !== undefined) {
    updates.recurrence_rule = trimToNull(dto.recurrence_rule);
  }
  if (targetStartedAt !== undefined) {
    updates.started_at = targetStartedAt ? new Date(targetStartedAt).toISOString() : null;
  }
  if (targetCompletedAt !== undefined) {
    updates.completed_at = targetCompletedAt ? new Date(targetCompletedAt).toISOString() : null;
  }
  if (dto.calories !== undefined) {
    updates.calories = ensureNonNegativeInteger("calories", dto.calories, "session") ?? null;
  }
  if (targetDeletedAt !== undefined) {
    updates.deleted_at = targetDeletedAt;
  }

  const completing = targetStatus === "completed" && current.status !== "completed";
  const fullGamificationRebuild = completing && current.gamification_rebuild_required === true;
  const movesStart =
    updates.planned_at !== undefined &&
    new Date(updates.planned_at).getTime() !== new Date(current.planned_at).getTime();
  const changesLength =
    updates.planned_duration_min !== undefined &&
    updates.planned_duration_min !== current.planned_duration_min;
  const occupiedStatus = targetStatus ?? current.status;
  const reschedulesTo: ScheduleWindow | undefined =
    (movesStart || changesLength) && occupiedStatus !== "canceled"
      ? {
          start: updates.planned_at ?? current.planned_at,
          durationMin: updates.planned_duration_min ?? current.planned_duration_min,
        }
      : undefined;

  await db.transaction(async (trx) => {
    if (dto.plan_id) {
      await ensurePlanExists(trx, dto.plan_id, userId);
    }

    if (reschedulesTo !== undefined) {
      await ensureScheduleSlotFree(userId, id, reschedulesTo, trx);
    }

    const affected = await updateSession(id, userId, updates, trx);
    if (affected === 0) {
      throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
    }

    if (normalizedExercises !== null) {
      await replaceSessionExercises(trx, id, normalizedExercises);
    }

    if (completing) {
      await markGamificationStale(userId, fullGamificationRebuild, trx);
    }
  });

  const includeDeleted = targetStatus === "canceled";
  const updated = await getSessionWithDetails(id, userId, { includeDeleted });
  if (!updated) {
    throw new HttpError(500, "E.SESSION.UPDATE_FAILED", "SESSION_UPDATE_FAILED");
  }

  const statusChanged = current.status !== updated.status;
  const exercisesTouched = normalizedExercises !== null;
  const visibilityChanged =
    dto.visibility !== undefined && current.visibility !== updated.visibility;

  if (statusChanged || visibilityChanged) {
    await reconcileSessionPublication(userId, id, updated.status, updated.visibility);
  }

  if (completing) {
    scheduleGamificationReconciliation(userId, id, fullGamificationRebuild);
  }

  if (statusChanged || exercisesTouched) {
    await refreshSessionSummary();
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "update",
    entityId: id,
    metadata: {
      changes: dto,
      exercise_count: dto.exercises ? dto.exercises.length : undefined,
    },
  });

  const planIdsToRecompute = new Set<string>();
  if (current.plan_id && current.plan_id !== updated.plan_id) {
    planIdsToRecompute.add(current.plan_id);
  }
  if (updated.plan_id) {
    planIdsToRecompute.add(updated.plan_id);
  }
  for (const planId of planIdsToRecompute) {
    await recomputeProgress(userId, planId);
  }

  return updated;
}

export { cloneOne, applyRecurrence } from "./sessions.clone.service.js";

export async function cancelOne(userId: string, id: string): Promise<void> {
  const current = await getSessionById(id, userId);
  if (!current) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  if (current.status === "completed") {
    throw new HttpError(
      400,
      "E.SESSION.CANNOT_CANCEL_COMPLETED",
      "Completed sessions cannot be canceled",
    );
  }

  const affected = await cancelSession(id, userId);
  if (affected === 0) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "cancel",
    entityId: id,
  });

  await reconcileSessionPublication(userId, id, "canceled", current.visibility);
  await refreshSessionSummary();

  if (current.plan_id) {
    await recomputeProgress(userId, current.plan_id);
  }
}

export async function reopenOne(userId: string, id: string): Promise<SessionWithExercises> {
  const current = await getSessionById(id, userId);
  if (!current) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  if (current.status !== "completed") {
    throw new HttpError(
      409,
      "E.SESSION.REOPEN_NOT_COMPLETED",
      "Only completed sessions can be reopened.",
    );
  }

  await db.transaction(async (trx) => {
    const affected = await updateSession(
      id,
      userId,
      {
        status: "in_progress",
        completed_at: null,
        completion_outcome: null,
        points: null,
        gamification_rebuild_required: true,
      },
      trx,
    );
    if (affected === 0) {
      throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
    }
    await markGamificationStale(userId, true, trx);
  });

  const reopened = await getSessionWithDetails(id, userId);
  if (!reopened) {
    throw new HttpError(500, "E.SESSION.UPDATE_FAILED", "SESSION_UPDATE_FAILED");
  }

  await reconcileSessionPublication(userId, id, reopened.status, reopened.visibility);
  await refreshSessionSummary();
  scheduleGamificationReconciliation(userId, undefined, true);

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "reopen",
    entityId: id,
    metadata: {
      previous_status: current.status,
      previous_completed_at: current.completed_at ?? null,
      reason: "workout_record_correction",
    },
  });

  if (current.plan_id) {
    await recomputeProgress(userId, current.plan_id);
  }

  return reopened;
}
