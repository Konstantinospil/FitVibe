import { Router } from "express";
import {
  listTypes,
  getType,
  createType,
  updateType,
  deleteType,
} from "./exerciseTypes.controller.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const exerciseTypesRouter = Router();

exerciseTypesRouter.get("/", rateLimit("types_list"), asyncHandler(listTypes));
exerciseTypesRouter.get("/:code", rateLimit("types_get"), asyncHandler(getType));

// Admin-only operations
exerciseTypesRouter.post(
  "/",
  rateLimit("types_create"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(createType),
);
exerciseTypesRouter.patch(
  "/:code",
  rateLimit("types_update"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(updateType),
);
exerciseTypesRouter.delete(
  "/:code",
  rateLimit("types_delete"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(deleteType),
);
