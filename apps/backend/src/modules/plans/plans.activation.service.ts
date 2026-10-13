import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  createSession,
  getSessionWithDetails,
  refreshSessionSummary,
  replaceSessionExercises,
  sessionsExistAtDates,
} from "../sessions/sessions.repository.js";
import {
  cloneExerciseInputsForReuse,
  convertExistingExerciseToInput,
  normalizeSessionExercises,
} from "../sessions/sessions.normalization.js";
import type { Session, SessionWithExercises } from "../sessions/sessions.types.js";
import { updatePlanProgress, type PlanRow } from "./plans.repository.js";
import { buildWeeklyOccurrences, planEndDate } from "./plans.activation.schedule.js";

/** Atomically activate a plan from its existing, first-week scheduled session templates. */
export async function activateUserPlan(userId: string, planId: string): Promise<PlanRow> {
  const result = await db.transaction(async (trx) => {
    // Serializes competing activations of the same plan.
    const plan = await trx<PlanRow>("plans")
      .where({ id: planId, user_id: userId })
      .whereNull("archived_at")
      .forUpdate()
      .first();
    if (!plan) {
      throw new HttpError(404, "E.PLAN.NOT_FOUND", "Plan not found");
    }
    if (plan.activated_at) {
      throw new HttpError(409, "E.PLAN.ALREADY_ACTIVATED", "Plan has already been activated");
    }
    if (plan.status === "completed") {
      throw new HttpError(409, "E.PLAN.COMPLETED", "Completed plan cannot be activated");
    }
    if (!plan.start_date || !plan.duration_weeks || !plan.target_frequency) {
      throw new HttpError(422, "E.PLAN.INCOMPLETE", "start_date, duration_weeks and target_frequency are required");
    }
    const startDate = new Date(plan.start_date).toISOString().slice(0, 10);
    const sourceRows = await trx<Session>("sessions")
      .where({ owner_id: userId, plan_id: planId })
      .whereNull("deleted_at")
      .orderBy("planned_at", "asc");
    if (sourceRows.some((row) => row.status !== "planned")) {
      throw new HttpError(422, "E.PLAN.INVALID_TEMPLATE", "All first-week plan sessions must be planned");
    }
    const occurrences = buildWeeklyOccurrences(
      startDate,
      Number(plan.duration_weeks),
      Number(plan.target_frequency),
      sourceRows.map(({ id, planned_at }) => ({ id, planned_at: new Date(planned_at).toISOString() })),
    );
    const endDate = planEndDate(startDate, Number(plan.duration_weeks));
    if (plan.end_date && new Date(plan.end_date).toISOString().slice(0, 10) !== endDate) {
      throw new HttpError(422, "E.PLAN.INVALID_END_DATE", "end_date must match duration_weeks");
    }
    const sources = new Map<string, SessionWithExercises>();
    for (const source of sourceRows) {
      const detail = await getSessionWithDetails(source.id, userId, {}, trx);
      if (!detail || detail.exercises.length === 0) {
        throw new HttpError(422, "E.PLAN.INVALID_TEMPLATE", "Every template must include planned exercises");
      }
      if (detail.recurrence_rule && !/^(?:RRULE:)?FREQ=WEEKLY(?:;INTERVAL=1)?$/i.test(detail.recurrence_rule.trim())) {
        throw new HttpError(422, "E.PLAN.UNSUPPORTED_RECURRENCE", "Only weekly recurrence is supported for plan templates");
      }
      sources.set(source.id, detail);
    }
    const conflicts = await sessionsExistAtDates(userId, occurrences.map((row) => row.plannedAt), trx);
    if (conflicts.length) {
      throw new HttpError(409, "E.PLAN.SCHEDULE_CONFLICT", "Existing sessions conflict with plan schedule", { conflicts });
    }
    const now = new Date().toISOString();
    for (const occurrence of occurrences) {
      const source = sources.get(occurrence.sourceId);
      if (!source) {
        throw new HttpError(500, "E.PLAN.MISSING_TEMPLATE", "Template disappeared during activation");
      }
      const id = uuidv4();
      await createSession({
        id, owner_id: userId, plan_id: planId, planned_at: occurrence.plannedAt,
        title: source.title ?? null, status: "planned", visibility: source.visibility,
        notes: source.notes ?? null, recurrence_rule: source.recurrence_rule ?? null,
        created_at: now, updated_at: now,
      }, trx);
      const exercises = normalizeSessionExercises(cloneExerciseInputsForReuse(
        source.exercises.map((exercise) => convertExistingExerciseToInput(exercise, false)),
      ));
      await replaceSessionExercises(trx, id, exercises);
    }
    await updatePlanProgress(planId, sourceRows.length + occurrences.length, 0, trx);
    const [updated] = await trx<PlanRow>("plans")
      .where({ id: planId, user_id: userId })
      .update({ status: "active", end_date: endDate, activated_at: now, updated_at: now })
      .returning("*");
    if (!updated) {
      throw new HttpError(500, "E.PLAN.ACTIVATION_FAILED", "Plan activation failed");
    }
    return { plan: updated, createdCount: occurrences.length };
  });
  await insertAudit({ actorUserId: userId, entityType: "plans", action: "activate", entityId: planId,
    metadata: { generated_sessions: result.createdCount, duration_weeks: result.plan.duration_weeks } });
  if (result.createdCount) {
    await refreshSessionSummary();
  }
  logger.info({ planId, createdCount: result.createdCount }, "[plans] Plan activated");
  return result.plan;
}
