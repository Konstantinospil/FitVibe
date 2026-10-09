/**
 * Admin controller - HTTP request handlers for admin endpoints
 */

import type { Request, Response } from "express";
import { HttpError, readRouteParam } from "../../utils/http.js";
import * as service from "./admin.service.js";
import type { ListReportsQuery, SearchUsersQuery } from "./admin.types.js";

/**
 * List feed reports
 * GET /api/v1/admin/reports
 */
export async function listReportsHandler(req: Request, res: Response): Promise<void> {
  const status = req.query.status as "pending" | "reviewed" | "dismissed" | "all" | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const query: ListReportsQuery = {
    status: status ?? "pending",
    limit: Math.min(limit, 100), // Cap at 100
    offset,
  };

  const reports = await service.listReports(query);
  res.json({ reports });
}

/**
 * Moderate a report
 * POST /api/v1/admin/reports/:reportId/moderate
 */
export async function moderateReportHandler(req: Request, res: Response): Promise<void> {
  const reportId = readRouteParam(req.params.reportId, "reportId");
  const action = (req.body as { action?: string }).action;

  if (!req.user?.sub) {
    throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
  }

  if (!action || !["dismiss", "hide", "ban"].includes(action)) {
    throw new HttpError(
      400,
      "INVALID_ACTION",
      "Invalid action. Must be 'dismiss', 'hide', or 'ban'",
    );
  }

  await service.moderateReport({
    reportId,
    action: action as "dismiss" | "hide" | "ban",
    adminId: req.user.sub,
  });

  // Handle past tense for actions
  const actionPastTense: Record<string, string> = {
    dismiss: "dismissed",
    hide: "hidden",
    ban: "banned",
  };
  const pastTense = actionPastTense[action] || `${action}ed`;

  res.json({ success: true, message: `Report ${pastTense} successfully` });
}

/**
 * Search users
 * GET /api/v1/admin/users/search
 */
export async function searchUsersHandler(req: Request, res: Response): Promise<void> {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const searchQuery: SearchUsersQuery = {
    query,
    limit: Math.min(limit, 50), // Cap at 50
    offset,
  };

  const users = await service.searchUsersService(searchQuery);
  res.json({ users });
}

/**
 * Perform user action (suspend, ban, activate, delete)
 * POST /api/v1/admin/users/:userId/action
 */
export async function userActionHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  const body = req.body as { action?: string; reason?: string };
  const action = body.action;
  const reason = body.reason;

  if (!req.user?.sub) {
    throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
  }

  if (!action || !["suspend", "ban", "activate", "delete"].includes(action)) {
    throw new HttpError(
      400,
      "INVALID_ACTION",
      "Invalid action. Must be 'suspend', 'ban', 'activate', or 'delete'",
    );
  }

  await service.performUserAction({
    userId,
    action: action as "suspend" | "ban" | "activate" | "delete",
    adminId: req.user.sub,
    reason,
  });

  // Handle past tense for actions
  const actionPastTense: Record<string, string> = {
    suspend: "suspended",
    ban: "banned",
    activate: "activated",
    delete: "deleted",
  };
  const pastTense = actionPastTense[action] || `${action}d`;

  res.json({ success: true, message: `User ${pastTense} successfully` });
}
