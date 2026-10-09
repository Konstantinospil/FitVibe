/**
 * Logs routes - Audit log querying and streaming endpoints
 *
 * Provides endpoints for querying audit logs with filtering capabilities.
 * All endpoints require admin role for security and privacy compliance.
 */

import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { listLogsHandler, recentActivityHandler, updateLogHandler, bulkUpdateLogsHandler } from "./logs.controller.js";

export const logsRouter = Router();

// All logs routes require authentication and admin role
logsRouter.use(requireAccessToken);
logsRouter.use(requireRole("admin"));

/**
 * GET /api/v1/logs
 * List audit logs with optional filtering
 * Query params: action, entityType, actorUserId, outcome, limit, offset
 */
logsRouter.get("/", rateLimit("logs_list"), asyncHandler(listLogsHandler));
logsRouter.patch("/bulk", rateLimit("logs_list"), asyncHandler(bulkUpdateLogsHandler));
logsRouter.patch("/:logId", rateLimit("logs_list"), asyncHandler(updateLogHandler));

/**
 * GET /api/v1/logs/recent-activity
 * Get recent admin activity for system dashboard
 * Query params: limit (default: 20)
 */
logsRouter.get(
  "/recent-activity",
  rateLimit("logs_recent_activity"),
  asyncHandler(recentActivityHandler),
);

export default logsRouter;
