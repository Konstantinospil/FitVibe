/**
 * Admin service - Business logic for admin operations
 */

import { HttpError } from "../../utils/http.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { db } from "../../db/index.js";
import { assertAdminTargetManageable } from "./admin-user-guard.js";
import { logAudit } from "../common/audit.util.js";
import * as repo from "./admin.repository.js";
import { checkHealth as checkClamavHealth } from "../../services/antivirus.service.js";
import { deleteStorageObject } from "../../services/mediaStorage.service.js";
import { deleteUserAvatarMetadata } from "../users/users.avatar.repository.js";
import { requestPasswordReset } from "../auth/auth.password.service.js";
import { resendVerificationEmail } from "../auth/auth.registration.service.js";
import { isEffectiveReadOnly } from "../system/app-settings.runtime.js";
import type {
  AdminAssignableRole,
  AdminOpsStatus,
  FeedReport,
  UserSearchResult,
  ModerateReportInput,
  UserActionInput,
  ListReportsQuery,
  SearchUsersQuery,
} from "./admin.types.js";

/** Upper bound for the frontend reachability probe, so the status header stays responsive. */
const FRONTEND_PROBE_TIMEOUT_MS = 1500;

async function checkDatabase(): Promise<boolean> {
  try {
    await db.raw("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * The configured public frontend origin answers HTTP. Any non-5xx response counts as
 * up; the URL comes from validated configuration, never from the request.
 */
async function checkFrontend(): Promise<boolean> {
  if (!env.frontendUrl) {
    return false;
  }
  try {
    const response = await fetch(env.frontendUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FRONTEND_PROBE_TIMEOUT_MS),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function getManageableUser(userId: string, adminId: string): Promise<UserSearchResult> {
  const user = await repo.getUserForAdmin(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "User not found");
  }
  assertAdminTargetManageable(adminId, userId, user.roleCode);
  return user;
}

/**
 * Operational status for the backoffice header: dependency health and work queues.
 */
export async function getOpsStatus(): Promise<AdminOpsStatus> {
  const [dbOk, clamavOk, frontendOk] = await Promise.all([
    checkDatabase(),
    checkClamavHealth(),
    checkFrontend(),
  ]);
  const readOnly = isEffectiveReadOnly();

  const [loggedInUsers, unresolvedMessages, violationReports, unresolvedAuditLogs] = dbOk
    ? await Promise.all([
        repo.countActiveSessions(),
        repo.countOpenMessages(),
        repo.countPendingReports(),
        repo.countUnresolvedAuditLogs(),
      ])
    : [0, 0, 0, 0];

  return {
    backend: {
      // checkClamavHealth reports a disabled scanner as unhealthy only in production.
      status: !dbOk ? "red" : readOnly || !clamavOk ? "yellow" : "green",
      dbOk,
      clamavOk,
      clamavEnabled: env.clamav.enabled,
      readOnly,
    },
    frontend: {
      status: frontendOk ? "green" : "red",
      ok: frontendOk,
    },
    counts: {
      loggedInUsers,
      unresolvedMessages,
      violationReports,
      unresolvedAuditLogs,
      openIssues: unresolvedMessages + violationReports + unresolvedAuditLogs,
    },
  };
}

/**
 * Change a non-privileged user's role among the non-privileged roles.
 * Granting or revoking admin/superadmin stays in the superadmin workflow.
 */
export async function changeUserRole(
  userId: string,
  roleCode: AdminAssignableRole,
  adminId: string,
  reason?: string,
): Promise<void> {
  const user = await getManageableUser(userId, adminId);
  if (user.roleCode === roleCode) {
    throw new HttpError(409, "ROLE_UNCHANGED", "User already has the requested role");
  }

  await repo.updateUserRole(userId, roleCode);
  await logAudit({
    action: "user_role_changed",
    entityType: "user",
    entityId: userId,
    userId: adminId,
    metadata: { username: user.username, oldRole: user.roleCode, newRole: roleCode, reason },
  });
}

/**
 * Re-send the verification email to a user who has not verified yet.
 * Uses the same token issuance and per-user limits as the public resend flow.
 */
export async function sendVerificationEmail(userId: string, adminId: string): Promise<void> {
  const user = await getManageableUser(userId, adminId);
  if (!user.email) {
    throw new HttpError(400, "NO_EMAIL", "User does not have an email address");
  }
  if (user.status !== "pending_verification") {
    throw new HttpError(
      400,
      "USER_ALREADY_VERIFIED",
      "Verification email can only be sent to unverified users",
    );
  }

  await resendVerificationEmail(user.email);
  await logAudit({
    action: "admin_sent_verification_email",
    entityType: "user",
    entityId: userId,
    userId: adminId,
    metadata: { username: user.username },
  });
}

/**
 * Send a password reset email to an active user through the public reset flow.
 */
export async function sendPasswordResetEmail(userId: string, adminId: string): Promise<void> {
  const user = await getManageableUser(userId, adminId);
  if (!user.email) {
    throw new HttpError(400, "NO_EMAIL", "User does not have an email address");
  }
  if (user.status !== "active") {
    throw new HttpError(400, "USER_NOT_ACTIVE", "Password reset can only be sent to active users");
  }

  await requestPasswordReset(user.email);
  await logAudit({
    action: "admin_sent_password_reset",
    entityType: "user",
    entityId: userId,
    userId: adminId,
    metadata: { username: user.username },
  });
}

/**
 * Remove a user's avatar (moderation action).
 */
export async function deleteUserAvatar(
  userId: string,
  adminId: string,
  reason?: string,
): Promise<void> {
  const user = await getManageableUser(userId, adminId);

  const metadata = await deleteUserAvatarMetadata(userId);
  if (!metadata) {
    throw new HttpError(404, "AVATAR_NOT_FOUND", "User has no avatar");
  }
  if (metadata.storage_key) {
    await deleteStorageObject(metadata.storage_key).catch((error: unknown) => {
      // The metadata row is gone, so the avatar is no longer served; log the orphaned file.
      logger.warn({ err: error, userId }, "[admin] Failed to delete avatar file from storage");
    });
  }

  await logAudit({
    action: "admin_deleted_avatar",
    entityType: "user",
    entityId: userId,
    userId: adminId,
    metadata: { username: user.username, reason },
  });
}

/**
 * Reset a user's display name to their alias (moderation action).
 */
export async function deleteUserDisplayName(
  userId: string,
  adminId: string,
  reason?: string,
): Promise<void> {
  const user = await getManageableUser(userId, adminId);

  await repo.resetUserDisplayNameToAlias(userId);
  await logAudit({
    action: "admin_deleted_display_name",
    entityType: "user",
    entityId: userId,
    userId: adminId,
    metadata: { username: user.username, previousDisplayName: user.displayName ?? null, reason },
  });
}

/**
 * List feed reports with optional filtering
 */
export async function listReports(query: ListReportsQuery): Promise<FeedReport[]> {
  return await repo.listFeedReports(query);
}

/**
 * Moderate a feed report
 */
export async function moderateReport(input: ModerateReportInput): Promise<void> {
  const { reportId, action, adminId } = input;

  // Get the report
  const report = await repo.getFeedReportById(reportId);
  if (!report) {
    throw new HttpError(404, "REPORT_NOT_FOUND", "Report not found");
  }

  if (report.status !== "pending") {
    throw new HttpError(400, "REPORT_ALREADY_RESOLVED", "Report has already been resolved");
  }

  // Perform the moderation action
  switch (action) {
    case "dismiss":
      await repo.updateReportStatus(reportId, "dismissed", adminId);
      await logAudit({
        action: "report_dismissed",
        entityType: "feed_report",
        entityId: reportId,
        userId: adminId,
        metadata: { reportId, reason: report.reason },
      });
      break;

    case "hide":
      // Hide the content
      if (report.feedItemId) {
        await repo.hideFeedItem(report.feedItemId);
      } else if (report.commentId) {
        await repo.hideComment(report.commentId);
      }
      await repo.updateReportStatus(reportId, "reviewed", adminId);
      await logAudit({
        action: "content_hidden",
        entityType: report.feedItemId ? "feed_item" : "feed_comment",
        entityId: report.feedItemId ?? report.commentId ?? reportId,
        userId: adminId,
        metadata: { reportId, action: "hide" },
      });
      break;

    case "ban": {
      // Resolve the actual feed item or comment owner by immutable user ID.
      // Never resolve moderation targets by partial alias/email search.
      const authorId = report.contentAuthorId;
      if (!authorId) {
        throw new HttpError(404, "REPORT_AUTHOR_NOT_FOUND", "Report author not found");
      }
      const author = await repo.getUserForAdmin(authorId);
      if (!author) {
        throw new HttpError(404, "USER_NOT_FOUND", "User not found");
      }
      assertAdminTargetManageable(adminId, authorId, author.roleCode);
      await repo.updateUserStatus(authorId, "banned");
      if (report.feedItemId) {
        await repo.hideFeedItem(report.feedItemId);
      } else if (report.commentId) {
        await repo.hideComment(report.commentId);
      }
      await repo.updateReportStatus(reportId, "reviewed", adminId);
      await logAudit({
        action: "user_banned",
        entityType: "user",
        entityId: authorId,
        userId: adminId,
        metadata: { reportId, action: "ban", reason: report.reason },
      });
      break;
    }

    default:
      throw new HttpError(400, "INVALID_ACTION", "Invalid moderation action");
  }
}

/**
 * Search users
 */
export async function searchUsersService(query: SearchUsersQuery): Promise<UserSearchResult[]> {
  return await repo.searchUsers(query);
}

/**
 * Perform user management action
 */
export async function performUserAction(input: UserActionInput): Promise<void> {
  const { userId, action, adminId, reason } = input;

  // Check if user exists
  const user = await repo.getUserForAdmin(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "User not found");
  }

  assertAdminTargetManageable(adminId, userId, user.roleCode);

  // Perform the action
  switch (action) {
    case "suspend":
      await repo.updateUserStatus(userId, "suspended");
      await logAudit({
        action: "user_suspended",
        entityType: "user",
        entityId: userId,
        userId: adminId,
        metadata: { username: user.username, reason },
      });
      break;

    case "ban":
      await repo.updateUserStatus(userId, "banned");
      await logAudit({
        action: "user_banned",
        entityType: "user",
        entityId: userId,
        userId: adminId,
        metadata: { username: user.username, reason },
      });
      break;

    case "activate":
      await repo.updateUserStatus(userId, "active");
      await logAudit({
        action: "user_activated",
        entityType: "user",
        entityId: userId,
        userId: adminId,
        metadata: { username: user.username, reason },
      });
      break;

    case "delete":
      await repo.softDeleteUser(userId);
      await logAudit({
        action: "user_deleted",
        entityType: "user",
        entityId: userId,
        userId: adminId,
        metadata: { username: user.username, reason },
      });
      break;

    default:
      throw new HttpError(400, "INVALID_ACTION", "Invalid user action");
  }
}
