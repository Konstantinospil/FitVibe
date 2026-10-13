import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import {
  findPlanById,
  listPlans,
  createPlan,
  updatePlan as updatePlanRepo,
  archivePlan as archivePlanRepo,
  deletePlan as deletePlanRepo,
  updatePlanProgress,
  countUserPlans,
  type PlanRow,
  type CreatePlanInput,
  type UpdatePlanInput,
} from "./plans.repository.js";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { logger } from "../../config/logger.js";

/**
 * Get a plan by ID, ensuring the user owns it
 */
export async function getPlanById(userId: string, planId: string): Promise<PlanRow> {
  const plan = await findPlanById(planId);

  if (!plan) {
    throw new HttpError(404, "E.PLAN.NOT_FOUND", "Plan not found");
  }

  if (plan.user_id !== userId) {
    throw new HttpError(403, "E.PLAN.FORBIDDEN", "Access denied to this plan");
  }

  return plan;
}

/**
 * List all plans for a user
 */
export async function listUserPlans(
  userId: string,
  options?: {
    status?: "active" | "completed";
    includeArchived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  },
): Promise<PlanRow[]> {
  return listPlans(
    {
      userId,
      status: options?.status,
      includeArchived: options?.includeArchived,
      search: options?.search,
    },
    {
      limit: options?.limit,
      offset: options?.offset,
    },
  );
}

/**
 * Create a new plan for a user
 */
export async function createUserPlan(
  userId: string,
  data: Omit<CreatePlanInput, "id" | "user_id" | "status">,
): Promise<PlanRow> {
  const planId = uuidv4();

  const input: CreatePlanInput = {
    id: planId,
    user_id: userId,
    name: data.name,
    start_date: data.start_date,
    end_date: data.end_date,
    ...(data.duration_weeks !== undefined ? { duration_weeks: data.duration_weeks } : {}),
    ...(data.target_frequency !== undefined ? { target_frequency: data.target_frequency } : {}),
  };

  return createPlan(input);
}

/**
 * Update an existing plan
 */
export async function updateUserPlan(
  userId: string,
  planId: string,
  updates: UpdatePlanInput,
): Promise<PlanRow> {
  const current = await getPlanById(userId, planId);
  if (
    current.activated_at &&
    (updates.start_date !== undefined ||
      updates.end_date !== undefined ||
      updates.duration_weeks !== undefined ||
      updates.target_frequency !== undefined)
  ) {
    throw new HttpError(409, "E.PLAN.ALREADY_ACTIVATED", "Activated plan schedule cannot be reconfigured");
  }

  const updatedCount = await updatePlanRepo(planId, updates);

  if (updatedCount === 0) {
    throw new HttpError(404, "E.PLAN.NOT_FOUND", "Plan not found or already archived");
  }

  const updated = await findPlanById(planId);
  if (!updated) {
    throw new HttpError(500, "E.PLAN.UPDATE_FAILED", "Failed to retrieve updated plan");
  }

  return updated;
}

/**
 * Archive a plan (soft delete)
 */
export async function archiveUserPlan(userId: string, planId: string): Promise<void> {
  // Verify ownership
  await getPlanById(userId, planId);

  const archivedCount = await archivePlanRepo(planId);

  if (archivedCount === 0) {
    throw new HttpError(404, "E.PLAN.NOT_FOUND", "Plan not found or already archived");
  }
}

/**
 * Soft delete a plan
 */
export async function deleteUserPlan(userId: string, planId: string): Promise<void> {
  // Verify ownership
  await getPlanById(userId, planId);

  const deletedCount = await deletePlanRepo(planId);

  if (deletedCount === 0) {
    throw new HttpError(404, "E.PLAN.NOT_FOUND", "Plan not found");
  }
}

/**
 * Recompute progress for a plan based on associated sessions.
 * This is called after session completion/update to refresh plan metrics.
 */
export async function recomputeProgress(
  userId: string,
  planId: string,
  trx?: Knex.Transaction,
): Promise<void> {
  logger.debug({ userId, planId }, "[plans] Recomputing plan progress");

  // Verify the plan exists and user has access (only if not in transaction)
  if (!trx) {
    await getPlanById(userId, planId);
  }

  // Count total sessions and completed sessions for this plan
  const sessionStats = await (trx ?? db)("sessions")
    .where({ plan_id: planId })
    .whereNull("deleted_at")
    .select(
      db.raw("COUNT(*) as total"),
      db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
    )
    .first<{ total: string; completed: string }>();

  const totalSessions = parseInt(sessionStats?.total ?? "0", 10);
  const completedSessions = parseInt(sessionStats?.completed ?? "0", 10);

  // Update plan progress
  await updatePlanProgress(planId, totalSessions, completedSessions, trx);

  logger.info(
    { planId, totalSessions, completedSessions },
    "[plans] Plan progress recomputed successfully",
  );
}

/**
 * Get plan statistics for a user
 */
export async function getUserPlanStats(
  userId: string,
): Promise<{ total: number; active: number; completed: number; archived: number }> {
  const [total, active, completed, archived] = await Promise.all([
    countUserPlans(userId, { includeArchived: true }),
    countUserPlans(userId, { status: "active" }),
    countUserPlans(userId, { status: "completed" }),
    countUserPlans(userId, { includeArchived: true })
      .then((t) => countUserPlans(userId, { includeArchived: false }).then((na) => t - na))
      .catch(() => 0),
  ]);

  return { total, active, completed, archived };
}

export { activateUserPlan } from "./plans.activation.service.js";
