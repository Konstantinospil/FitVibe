import { Router } from "express";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addBioValue,
  addPerfValue,
  createBioAttribute,
  createPerfAttribute,
  listBioAttributes,
  listPerfAttributes,
  updateBioVisibility,
  updatePerfVisibility,
} from "./measurements.controller.js";

export const measurementsRouter = Router();

measurementsRouter.get(
  "/biometrics/attributes",
  rateLimit("measurements_bio_list"),
  requireAccessToken,
  asyncHandler(listBioAttributes),
);
measurementsRouter.post(
  "/biometrics/attributes",
  rateLimit("measurements_bio_create"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(createBioAttribute),
);
measurementsRouter.post(
  "/biometrics/attributes/:attributeId/values",
  rateLimit("measurements_bio_value"),
  requireAccessToken,
  asyncHandler(addBioValue),
);
measurementsRouter.put(
  "/biometrics/attributes/:attributeId/visibility",
  rateLimit("measurements_bio_visibility"),
  requireAccessToken,
  asyncHandler(updateBioVisibility),
);

measurementsRouter.get(
  "/performance/attributes",
  rateLimit("measurements_perf_list"),
  requireAccessToken,
  asyncHandler(listPerfAttributes),
);
measurementsRouter.post(
  "/performance/attributes",
  rateLimit("measurements_perf_create"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(createPerfAttribute),
);
measurementsRouter.post(
  "/performance/attributes/:attributeId/values",
  rateLimit("measurements_perf_value"),
  requireAccessToken,
  asyncHandler(addPerfValue),
);
measurementsRouter.put(
  "/performance/attributes/:attributeId/visibility",
  rateLimit("measurements_perf_visibility"),
  requireAccessToken,
  asyncHandler(updatePerfVisibility),
);
