import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import {
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
  SessionQuery,
  PaginatedResult,
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

const allowedTransitions: Record<string, string[]> = {
  planned: ["in_progress", "completed", "canceled"],
  in_progress: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export async function getAll(
  userId: string,
  query: SessionQuery,
): Promise<PaginatedResult<Session>> {
  return listSessions(userId, query);
}

export async function getOne(userId: string, id: string): Promise<SessionWithExercises> {
  const accessSession = await loadSessionOrThrow(id);
  await ensureSessionInteractionAllowed(userId, accessSession);

  const session = await getSessionWithDetails(id, accessSession.owner_id);
  if (!session) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  return session;
}

export async function createOne(
  userId: string,
  dto: CreateSessionDTO,
): Promise<SessionWithExercises> {
  const normalizedExercises = normalizeSessionExercises(dto.exercises);
  const sessionId = uuidv4();
  const now = new Date();
  const timestamp = now.toISOString();

  const row: Session = {
    id: sessionId,
    owner_id: userId,
    plan_id: dto.plan_id ?? null,
    title: trimToNull(dto.title),
    planned_at: new Date(dto.planned_at).toISOString(),
    status: "planned",
    visibility: dto.visibility ?? "private",
    notes: trimToNull(dto.notes),
    recurrence_rule: trimToNull(dto.recurrence_rule),
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
  let targetStartedAt = dto.started_at;
  let targetCompletedAt = dto.completed_at;
  let targetDeletedAt: string | null | undefined;

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
    if (targetStatus === "canceled") {
      targetDeletedAt = nowIso;
    }
  }

  const updates: Partial<Session> = {
    updated_at: new Date().toISOString(),
  };

  if (dto.plan_id !== undefined) {
    updates.plan_id = dto.plan_id ?? null;
  }
  if (dto.title !== undefined) {
    updates.title = trimToNull(dto.title);
  }
  if (dto.planned_at) {
    updates.planned_at = new Date(dto.planned_at).toISOString();
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

  await db.transaction(async (trx) => {
    if (dto.plan_id) {
      await ensurePlanExists(trx, dto.plan_id, userId);
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
