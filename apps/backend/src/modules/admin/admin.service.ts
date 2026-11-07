/**
 * Admin service - Business logic for admin operations
 */

import { HttpError } from "../../utils/http.js";
import { assertAdminTargetManageable } from "./admin-user-guard.js";
import { logAudit } from "../common/audit.util.js";
import * as repo from "./admin.repository.js";
import type {
  FeedReport,
  UserSearchResult,
  ModerateReportInput,
  UserActionInput,
  ListReportsQuery,
  SearchUsersQuery,
} from "./admin.types.js";

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
