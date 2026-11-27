/**
 * Admin controller - HTTP request handlers for admin endpoints
 */

import type { Request, Response } from "express";
import { HttpError, readRouteParam } from "../../utils/http.js";
import * as service from "./admin.service.js";
import { db } from "../../db/index.js";
import type { ListReportsQuery, SearchUsersQuery } from "./admin.types.js";
import { assertFreshPrivilegedTotp } from "./superadmin.service.js";
import { isAdminAssignableRole } from "./admin-user-guard.js";

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
  const body = (req.body ?? {}) as { action?: string; totpCode?: string };
  const action = body.action;

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

  // Dismissing a report changes only its review status; hiding or banning
  // content requires a fresh, single-use administrator TOTP challenge.
  if (action !== "dismiss") {
    if (typeof body.totpCode !== "string" || !/^\d{6}$/.test(body.totpCode)) {
      throw new HttpError(403, "ADMIN_STEP_UP_REQUIRED", "Fresh administrator TOTP required");
    }
    await assertFreshPrivilegedTotp(req.user.sub, body.totpCode);
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
  const body = (req.body ?? {}) as { action?: string; reason?: string; totpCode?: string };
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

  // Suspension, ban, activation and deletion are identity-impacting changes.
  // Check a fresh TOTP before invoking any persistence side effect.
  if (typeof body.totpCode !== "string" || !/^\d{6}$/.test(body.totpCode)) {
    throw new HttpError(403, "ADMIN_STEP_UP_REQUIRED", "Fresh administrator TOTP required");
  }
  await assertFreshPrivilegedTotp(req.user.sub, body.totpCode);

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

function requireAdminId(req: Request): string {
  if (!req.user?.sub) {
    throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
  }
  return req.user.sub;
}

/** Longest free-text reason an administrator may attach to an action, in characters. */
export const ADMIN_REASON_MAX_LENGTH = 500;

function readOptionalReason(body: { reason?: unknown }): string | undefined {
  if (body.reason === undefined || body.reason === null) {
    return undefined;
  }
  if (typeof body.reason !== "string" || body.reason.length > ADMIN_REASON_MAX_LENGTH) {
    throw new HttpError(
      400,
      "INVALID_REASON",
      `Reason must be a string of at most ${ADMIN_REASON_MAX_LENGTH} characters`,
    );
  }
  return body.reason.trim() || undefined;
}

/** Permission- and content-changing actions need a fresh, single-use administrator TOTP. */
async function requireFreshTotp(adminId: string, totpCode: unknown): Promise<void> {
  if (typeof totpCode !== "string" || !/^\d{6}$/.test(totpCode)) {
    throw new HttpError(403, "ADMIN_STEP_UP_REQUIRED", "Fresh administrator TOTP required");
  }
  await assertFreshPrivilegedTotp(adminId, totpCode);
}

/**
 * Operational status for the backoffice header
 * GET /api/v1/admin/ops/status
 */
export async function getOpsStatusHandler(_req: Request, res: Response): Promise<void> {
  res.json(await service.getOpsStatus());
}

/**
 * Change a non-privileged user's role
 * POST /api/v1/admin/users/:userId/role
 */
export async function changeUserRoleHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  const adminId = requireAdminId(req);
  const body = (req.body ?? {}) as { role?: unknown; reason?: unknown; totpCode?: unknown };

  if (!isAdminAssignableRole(body.role)) {
    throw new HttpError(
      400,
      "INVALID_ROLE",
      "Invalid role. Must be 'athlete', 'coach' or 'support'; privileged roles are managed by a superadmin",
    );
  }
  const reason = readOptionalReason(body);
  await requireFreshTotp(adminId, body.totpCode);

  await service.changeUserRole(userId, body.role, adminId, reason);
  res.json({ success: true, message: `User role changed to ${body.role} successfully` });
}

/**
 * Re-send the verification email
 * POST /api/v1/admin/users/:userId/send-verification-email
 */
export async function sendVerificationEmailHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  await service.sendVerificationEmail(userId, requireAdminId(req));
  res.json({ success: true, message: "Verification email sent successfully" });
}

/**
 * Send a password reset email
 * POST /api/v1/admin/users/:userId/send-password-reset
 */
export async function sendPasswordResetHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  await service.sendPasswordResetEmail(userId, requireAdminId(req));
  res.json({ success: true, message: "Password reset email sent successfully" });
}

/**
 * Remove a user's avatar
 * DELETE /api/v1/admin/users/:userId/avatar
 */
export async function deleteUserAvatarHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  const adminId = requireAdminId(req);
  const body = (req.body ?? {}) as { reason?: unknown; totpCode?: unknown };
  const reason = readOptionalReason(body);
  await requireFreshTotp(adminId, body.totpCode);

  await service.deleteUserAvatar(userId, adminId, reason);
  res.json({ success: true, message: "User avatar deleted successfully" });
}

/**
 * Reset a user's display name to their alias
 * DELETE /api/v1/admin/users/:userId/display-name
 */
export async function deleteUserDisplayNameHandler(req: Request, res: Response): Promise<void> {
  const userId = readRouteParam(req.params.userId, "userId");
  const adminId = requireAdminId(req);
  const body = (req.body ?? {}) as { reason?: unknown; totpCode?: unknown };
  const reason = readOptionalReason(body);
  await requireFreshTotp(adminId, body.totpCode);

  await service.deleteUserDisplayName(userId, adminId, reason);
  res.json({ success: true, message: "User display name deleted successfully" });
}

/** GET /api/v1/admin/action-mappings */
export async function listActionMappingsHandler(_req: Request, res: Response): Promise<void> {
  const rows = await db("audit_log as al")
    .distinct("al.action")
    .leftJoin("audit_action_mappings as am", "am.action", "al.action")
    .select("al.action", "am.ui_name as uiName")
    .orderBy("al.action", "asc");
  res.json({ mappings: rows });
}

/** POST /api/v1/admin/action-mappings */
export async function upsertActionMappingHandler(req: Request, res: Response): Promise<void> {
  const { action, uiName } = (req.body ?? {}) as { action?: unknown; uiName?: unknown };
  if (
    typeof action !== "string" ||
    !action.trim() ||
    action.length > 255 ||
    typeof uiName !== "string" ||
    !uiName.trim() ||
    uiName.length > 255
  ) {
    throw new HttpError(400, "INVALID_ACTION_MAPPING", "Action and display name are required");
  }
  const rows = (await db("audit_action_mappings")
    .insert({ action: action.trim(), ui_name: uiName.trim(), updated_at: db.fn.now() })
    .onConflict("action")
    .merge(["ui_name", "updated_at"])
    .returning(["action", "ui_name as uiName"])) as { action: string; uiName: string }[];
  res.json({ mapping: rows[0] ?? null });
}
