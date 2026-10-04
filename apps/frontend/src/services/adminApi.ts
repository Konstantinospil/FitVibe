/**
 * Admin API service
 * Contains API calls for admin-only operations
 */

import { apiClient } from "./httpApi";
import type { UserStatus } from "@fitvibe/contracts";

// Types
export interface FeedReport {
  id: string;
  reporterUsername: string;
  feedItemId?: string | null;
  commentId?: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  contentPreview: string | null;
  contentAuthor: string | null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  roleCode: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  reportCount: number;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  entityType: string;
  action: string;
  entityId: string | null;
  outcome: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Content Reports
export async function listReports(params?: {
  status?: "pending" | "reviewed" | "dismissed" | "all";
  limit?: number;
  offset?: number;
}): Promise<FeedReport[]> {
  const response = await apiClient.get<{ reports: FeedReport[] }>("/api/v1/admin/reports", {
    params,
  });
  return response.data.reports;
}

export async function moderateReport(
  reportId: string,
  action: "dismiss" | "hide" | "ban",
): Promise<void> {
  await apiClient.post(`/api/v1/admin/reports/${reportId}/moderate`, { action });
}

// User Management
export async function searchUsers(
  query: string,
  params?: { limit?: number; offset?: number },
): Promise<UserRecord[]> {
  const response = await apiClient.get<{ users: UserRecord[] }>("/api/v1/admin/users/search", {
    params: { q: query, ...params },
  });
  return response.data.users;
}

export async function performUserAction(
  userId: string,
  action: "suspend" | "ban" | "activate" | "delete",
  reason?: string,
): Promise<void> {
  await apiClient.post(`/api/v1/admin/users/${userId}/action`, { action, reason });
}

// Audit Logs
export async function listAuditLogs(params?: {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<{ logs: AuditLogEntry[] }>("/api/v1/logs", { params });
  return response.data.logs;
}

export async function getRecentActivity(limit?: number): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<{ activity: AuditLogEntry[] }>(
    "/api/v1/logs/recent-activity",
    {
      params: { limit },
    },
  );
  return response.data.activity;
}
