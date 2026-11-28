import type { UserStatus } from "../users/users.types.js";

/**
 * Admin module types
 */

export interface FeedReport {
  id: string;
  reporterId: string;
  reporterUsername: string;
  feedItemId: string | null;
  commentId: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  contentPreview: string | null;
  contentAuthor: string | null;
  contentAuthorId?: string | null;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  roleCode: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  reportCount: number;
}

export interface ModerateReportInput {
  reportId: string;
  action: "dismiss" | "hide" | "ban";
  adminId: string;
}

export interface UserActionInput {
  userId: string;
  action: "suspend" | "ban" | "activate" | "delete";
  adminId: string;
  reason?: string;
}

export type OpsLightStatus = "green" | "yellow" | "red";

export interface AdminOpsStatus {
  backend: {
    status: OpsLightStatus;
    dbOk: boolean;
    clamavOk: boolean;
    clamavEnabled: boolean;
    readOnly: boolean;
  };
  frontend: {
    status: OpsLightStatus;
    ok: boolean;
  };
  /** Null while the database is unreachable: the counts are unknown, not zero. */
  counts: {
    loggedInUsers: number | null;
    unresolvedMessages: number | null;
    violationReports: number | null;
    unresolvedAuditLogs: number | null;
    openIssues: number | null;
  };
}

/** Roles a normal administrator may assign. Privileged roles use the superadmin workflow. */
export const ADMIN_ASSIGNABLE_ROLES = ["athlete", "coach", "support"] as const;
export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number];

export interface ListReportsQuery {
  status?: "pending" | "reviewed" | "dismissed" | "all";
  limit?: number;
  offset?: number;
}

export interface SearchUsersQuery {
  query: string;
  limit?: number;
  offset?: number;
}
