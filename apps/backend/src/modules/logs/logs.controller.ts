/**
 * Logs controller - HTTP request handlers for audit log endpoints
 */

import type { Request, Response } from "express";
import * as service from "./logs.service.js";
import * as repo from "./logs.repository.js";
import { HttpError, readRouteParam } from "../../utils/http.js";
import type { ListAuditLogsQuery } from "./logs.types.js";

/**
 * List audit logs
 * GET /api/v1/logs
 */
export async function listLogsHandler(req: Request, res: Response): Promise<void> {
  const action = req.query.action as string | string[] | undefined;
  const entityType = req.query.entityType as string | undefined;
  const actorUserId = req.query.actorUserId as string | undefined;
  const outcome = req.query.outcome as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const query: ListAuditLogsQuery = {
    action,
    entityType,
    actorUserId,
    outcome,
    limit,
    offset,
    requestId: req.query.requestId as string | undefined,
    severity: req.query.severity as string | undefined,
    resolved:
      req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined,
    createdFrom: req.query.createdFrom as string | undefined,
    createdTo: req.query.createdTo as string | undefined,
  };

  const logs = await service.listLogs(query);
  res.json({ logs });
}

/**
 * Get recent admin activity
 * GET /api/v1/logs/recent-activity
 */
export async function recentActivityHandler(req: Request, res: Response): Promise<void> {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const activity = await service.getRecentActivity(limit);
  res.json({ activity });
}

export async function updateLogHandler(req: Request, res: Response): Promise<void> {
  const id = readRouteParam(req.params.logId, "logId");
  const body = req.body as { severity?: string; resolved?: boolean };
  if (
    (body.severity === undefined && body.resolved === undefined) ||
    (body.severity !== undefined &&
      !["info", "warning", "error", "critical"].includes(body.severity)) ||
    (body.resolved !== undefined && typeof body.resolved !== "boolean")
  ) {
    throw new HttpError(400, "INVALID_LOG_UPDATE", "Invalid log review update");
  }
  const log = await repo.updateAuditLog(id, body);
  if (!log) {
    throw new HttpError(404, "LOG_NOT_FOUND", "Log not found");
  }
  res.json({ log });
}

export async function bulkUpdateLogsHandler(req: Request, res: Response): Promise<void> {
  const { ids, resolved } = req.body as { ids?: unknown; resolved?: unknown };
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 500 ||
    !ids.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) ||
    typeof resolved !== "boolean"
  ) {
    throw new HttpError(400, "INVALID_LOG_UPDATE", "Invalid bulk review update");
  }
  const updated = await repo.bulkResolveAuditLogs(ids as string[], resolved);
  res.json({ updated });
}
