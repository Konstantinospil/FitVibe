import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import {
  listPlansHandler,
  getPlanHandler,
  createPlanHandler,
  updatePlanHandler,
  archivePlanHandler,
  deletePlanHandler,
  getPlanStatsHandler,
  activatePlanHandler,
} from "./plans.controller.js";

export const plansRouter = Router();

// All plans routes require authentication
plansRouter.use(requireAccessToken);

// GET /api/v1/plans/stats - Get plan statistics
plansRouter.get("/stats", asyncHandler(getPlanStatsHandler));

// GET /api/v1/plans - List all plans
plansRouter.get("/", asyncHandler(listPlansHandler));

// POST /api/v1/plans - Create a new plan
plansRouter.post("/", asyncHandler(createPlanHandler));

// GET /api/v1/plans/:id - Get a single plan
plansRouter.get("/:id", asyncHandler(getPlanHandler));

// PATCH /api/v1/plans/:id - Update a plan
plansRouter.patch("/:id", asyncHandler(updatePlanHandler));

// POST /api/v1/plans/:id/activate
plansRouter.post("/:id/activate", asyncHandler(activatePlanHandler));

// POST /api/v1/plans/:id/archive - Archive a plan
plansRouter.post("/:id/archive", asyncHandler(archivePlanHandler));

// DELETE /api/v1/plans/:id - Delete a plan
plansRouter.delete("/:id", asyncHandler(deletePlanHandler));

export default plansRouter;
