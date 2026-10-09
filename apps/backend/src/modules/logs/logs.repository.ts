/**
 * Logs repository - Database operations for audit logs
 */

import { db } from "../../db/index.js";
import type { AuditLogEntry, ListAuditLogsQuery } from "./logs.types.js";

/**
 * List audit log entries with optional filtering
 */
export async function listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogEntry[]> {
  const {
    action,
    entityType,
    actorUserId,
    outcome,
    requestId,
    severity,
    resolved,
    createdFrom,
    createdTo,
    limit = 100,
    offset = 0,
  } = query;

  let queryBuilder = db("audit_log as al")
    .select(
      "al.id",
      "al.actor_user_id as actorUserId",
      "al.entity_type as entityType",
      "al.action",
      "al.entity_id as entityId",
      "al.outcome",
      "al.request_id as requestId",
      "al.metadata",
      "al.created_at as createdAt",
      "al.severity",
      "al.resolved_at as resolvedAt",
    )
    .leftJoin("users as u", "al.actor_user_id", "u.id")
    .leftJoin("profiles as p", "p.user_id", "al.actor_user_id")
    .select("p.alias as actorUsername")
    .orderBy("al.created_at", "desc")
    .limit(Math.min(limit, 500)) // Cap at 500
    .offset(offset);

  if (action) {
    queryBuilder = Array.isArray(action)
      ? queryBuilder.whereIn("al.action", action)
      : queryBuilder.where("al.action", action);
  }

  if (entityType) {
    queryBuilder = queryBuilder.where("al.entity_type", entityType);
  }

  if (actorUserId) {
    queryBuilder = queryBuilder.where("al.actor_user_id", actorUserId);
  }

  if (outcome) {
    queryBuilder = queryBuilder.where("al.outcome", outcome);
  }

  if (requestId) {
    queryBuilder = queryBuilder.where("al.request_id", requestId);
  }
  if (severity) {
    queryBuilder = queryBuilder.where("al.severity", severity);
  }
  if (resolved !== undefined) {
    queryBuilder = resolved
      ? queryBuilder.whereNotNull("al.resolved_at")
      : queryBuilder.whereNull("al.resolved_at");
  }
  if (createdFrom) {
    queryBuilder = queryBuilder.where("al.created_at", ">=", createdFrom);
  }
  if (createdTo) {
    queryBuilder = queryBuilder.where("al.created_at", "<=", createdTo);
  }

  const rows = await queryBuilder;
  return rows as AuditLogEntry[];
}

/**
 * Get recent admin activity for system dashboard
 */
export async function getRecentAdminActivity(limit = 20): Promise<AuditLogEntry[]> {
  const rows = await db("audit_log as al")
    .select(
      "al.id",
      "al.actor_user_id as actorUserId",
      "al.entity_type as entityType",
      "al.action",
      "al.entity_id as entityId",
      "al.outcome",
      "al.request_id as requestId",
      "al.metadata",
      "al.created_at as createdAt",
      "al.severity",
      "al.resolved_at as resolvedAt",
    )
    .leftJoin("users as u", "al.actor_user_id", "u.id")
    .leftJoin("profiles as p", "p.user_id", "al.actor_user_id")
    .select("p.alias as actorUsername")
    .whereIn("al.action", [
      "user_suspended",
      "user_banned",
      "user_activated",
      "user_deleted",
      "report_dismissed",
      "content_hidden",
      "system_maintenance_enabled",
      "system_maintenance_disabled",
    ])
    .orderBy("al.created_at", "desc")
    .limit(limit);

  return rows as AuditLogEntry[];
}

/** Review operations are scoped to log records; audit metadata remains immutable. */
export async function updateAuditLog(
  id: string,
  updates: { severity?: string; resolved?: boolean },
): Promise<AuditLogEntry | null> {
  const update: Record<string, unknown> = {};
  if (updates.severity !== undefined) {
    update.severity = updates.severity;
  }
  if (updates.resolved !== undefined) {
    update.resolved_at = updates.resolved ? db.fn.now() : null;
  }
  const rows = (await db("audit_log")
    .where("id", id)
    .update(update)
    .returning("id")) as Array<{ id: string }>;
  if (!rows.length) {
    return null;
  }
  // Fetch by id to avoid returning the newest unrelated entry.
  const match = (await db("audit_log as al")
    .select(
      "al.id",
      "al.actor_user_id as actorUserId",
      "al.entity_type as entityType",
      "al.action",
      "al.entity_id as entityId",
      "al.outcome",
      "al.request_id as requestId",
      "al.metadata",
      "al.created_at as createdAt",
      "al.severity",
      "al.resolved_at as resolvedAt",
    )
    .leftJoin("profiles as p", "p.user_id", "al.actor_user_id")
    .select("p.alias as actorUsername")
    .where("al.id", id)
    .first()) as AuditLogEntry | undefined;
  return match ?? null;
}

export async function bulkResolveAuditLogs(ids: string[], resolved: boolean): Promise<number> {
  return await db("audit_log").whereIn("id", ids).update({ resolved_at: resolved ? db.fn.now() : null });
}
