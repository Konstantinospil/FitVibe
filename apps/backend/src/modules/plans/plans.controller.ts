import type { Request, Response } from "express";
import { z } from "zod";
import {
  getPlanById,
  listUserPlans,
  createUserPlan,
  updateUserPlan,
  archiveUserPlan,
  deleteUserPlan,
  getUserPlanStats,
} from "./plans.service.js";
import { HttpError } from "../../utils/http.js";

/**
 * Helper to get authenticated user ID from request
 */
function requireUser(req: Request): string {
  const userId = req.user?.sub;
  if (!userId || typeof userId !== "string") {
    throw new HttpError(401, "E.AUTH.REQUIRED", "Authentication required");
  }
  return userId;
}

/**
 * GET /api/v1/plans
 * List all plans for the authenticated user
 */
export async function listPlansHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);

  const statusValue = req.query.status;
  if (statusValue !== undefined && statusValue !== "active" && statusValue !== "completed") {
    throw new HttpError(400, "E.PLAN.INVALID_STATUS", "Invalid plan status");
  }
  const status = statusValue as "active" | "completed" | undefined;
  const includeArchived = req.query.includeArchived === "true";
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
  const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : undefined;

  const plans = await listUserPlans(userId, {
    status,
    includeArchived,
    search,
    limit,
    offset,
  });

  res.json({ plans });
}

/**
 * GET /api/v1/plans/stats
 * Get plan statistics for the authenticated user
 */
export async function getPlanStatsHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const stats = await getUserPlanStats(userId);
  res.json(stats);
}

/**
 * GET /api/v1/plans/:id
 * Get a single plan by ID
 */
export async function getPlanHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const id = readRouteParam(req.params.id, "id");

  if (!id) {
    throw new HttpError(400, "E.PLAN.INVALID_ID", "Plan ID is required");
  }

  const plan = await getPlanById(userId, id);
  res.json(plan);
}

const createPlanSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

/**
 * POST /api/v1/plans
 * Create a new plan
 */
export async function createPlanHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);

  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "E.PLAN.INVALID_INPUT", "Invalid plan data", parsed.error.flatten());
  }

  const plan = await createUserPlan(userId, parsed.data);
  res.status(201).json(plan);
}

const updatePlanSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["active", "completed"]).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

/**
 * PATCH /api/v1/plans/:id
 * Update an existing plan
 */
export async function updatePlanHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const id = readRouteParam(req.params.id, "id");

  if (!id) {
    throw new HttpError(400, "E.PLAN.INVALID_ID", "Plan ID is required");
  }

  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "E.PLAN.INVALID_INPUT", "Invalid update data", parsed.error.flatten());
  }

  const plan = await updateUserPlan(userId, id, parsed.data);
  res.json(plan);
}

/**
 * POST /api/v1/plans/:id/archive
 * Archive a plan (soft delete)
 */
export async function archivePlanHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const id = readRouteParam(req.params.id, "id");

  if (!id) {
    throw new HttpError(400, "E.PLAN.INVALID_ID", "Plan ID is required");
  }

  await archiveUserPlan(userId, id);
  res.status(204).send();
}

/**
 * DELETE /api/v1/plans/:id
 * Soft delete a plan
 */
export async function deletePlanHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const id = readRouteParam(req.params.id, "id");

  if (!id) {
    throw new HttpError(400, "E.PLAN.INVALID_ID", "Plan ID is required");
  }

  await deleteUserPlan(userId, id);
  res.status(204).send();
}
