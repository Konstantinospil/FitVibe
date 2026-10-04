/**
 * Admin repository - Database operations for admin functionality
 */

import { db } from "../../db/index.js";
import type { UserStatus } from "../users/users.types.js";
export { isEmailBlacklisted } from "../common/email-blacklist.repository.js";
import type {
  FeedReport,
  UserSearchResult,
  ListReportsQuery,
  SearchUsersQuery,
} from "./admin.types.js";

/**
 * List feed reports with optional filtering
 */
export async function listFeedReports(query: ListReportsQuery): Promise<FeedReport[]> {
  const { status = "pending", limit = 50, offset = 0 } = query;

  let queryBuilder = db("feed_reports as fr")
    .select(
      "fr.id",
      "fr.reporter_id as reporterId",
      "reporter_profile.alias as reporterUsername",
      "fr.feed_item_id as feedItemId",
      "fr.comment_id as commentId",
      "fr.reason",
      "fr.details",
      "fr.status",
      "fr.created_at as createdAt",
      "fr.resolved_at as resolvedAt",
      "fr.resolved_by as resolvedBy",
    )
    .leftJoin("users as reporter", "fr.reporter_id", "reporter.id")
    .leftJoin("profiles as reporter_profile", "reporter_profile.user_id", "fr.reporter_id")
    .leftJoin("feed_items as fi", "fr.feed_item_id", "fi.id")
    .leftJoin("sessions as s", "fi.session_id", "s.id")
    .leftJoin("feed_comments as fc", "fr.comment_id", "fc.id")
    .leftJoin("users as content_author_feed", "fi.owner_id", "content_author_feed.id")
    .leftJoin(
      "profiles as content_author_feed_profile",
      "content_author_feed_profile.user_id",
      "fi.owner_id",
    )
    .leftJoin("users as content_author_comment", "fc.user_id", "content_author_comment.id")
    .leftJoin(
      "profiles as content_author_comment_profile",
      "content_author_comment_profile.user_id",
      "fc.user_id",
    )
    .select(
      db.raw(`
        COALESCE(
          SUBSTRING(s.title, 1, 200),
          SUBSTRING(fc.body, 1, 200)
        ) as "contentPreview"
      `),
    )
    .select(
      db.raw(`
        COALESCE(
          content_author_feed_profile.alias,
          content_author_comment_profile.alias
        ) as "contentAuthor"
      `),
    )
    .orderBy("fr.created_at", "desc")
    .limit(limit)
    .offset(offset);

  if (status !== "all") {
    queryBuilder = queryBuilder.where("fr.status", status);
  }

  const rows = await queryBuilder;
  return rows as FeedReport[];
}

/**
 * Get a single feed report by ID
 */
export async function getFeedReportById(reportId: string): Promise<FeedReport | null> {
  const row = (await db<FeedReport>("feed_reports as fr")
    .select(
      "fr.id",
      "fr.reporter_id as reporterId",
      "reporter_profile.alias as reporterUsername",
      "fr.feed_item_id as feedItemId",
      "fr.comment_id as commentId",
      "fr.reason",
      "fr.details",
      "fr.status",
      "fr.created_at as createdAt",
      "fr.resolved_at as resolvedAt",
      "fr.resolved_by as resolvedBy",
    )
    .leftJoin("users as reporter", "fr.reporter_id", "reporter.id")
    .leftJoin("profiles as reporter_profile", "reporter_profile.user_id", "fr.reporter_id")
    .leftJoin("feed_items as fi", "fr.feed_item_id", "fi.id")
    .leftJoin("sessions as s", "fi.session_id", "s.id")
    .leftJoin("feed_comments as fc", "fr.comment_id", "fc.id")
    .leftJoin("users as content_author_feed", "fi.owner_id", "content_author_feed.id")
    .leftJoin(
      "profiles as content_author_feed_profile",
      "content_author_feed_profile.user_id",
      "fi.owner_id",
    )
    .leftJoin("users as content_author_comment", "fc.user_id", "content_author_comment.id")
    .leftJoin(
      "profiles as content_author_comment_profile",
      "content_author_comment_profile.user_id",
      "fc.user_id",
    )
    .select(
      db.raw(`
        COALESCE(
          SUBSTRING(s.title, 1, 200),
          SUBSTRING(fc.body, 1, 200)
        ) as "contentPreview"
      `),
    )
    .select(
      db.raw(`
        COALESCE(
          content_author_feed_profile.alias,
          content_author_comment_profile.alias
        ) as "contentAuthor"
      `),
    )
    .where("fr.id", reportId)
    .first()) as FeedReport | undefined;

  return row ?? null;
}

/**
 * Update report status (dismiss or reviewed)
 */
export async function updateReportStatus(
  reportId: string,
  status: "dismissed" | "reviewed",
  adminId: string,
): Promise<void> {
  await db("feed_reports").where("id", reportId).update({
    status,
    resolved_at: db.fn.now(),
    resolved_by: adminId,
  });
}

/**
 * Hide feed item by setting its visibility to private
 */
export async function hideFeedItem(feedItemId: string): Promise<void> {
  await db("feed_items").where("id", feedItemId).update({
    visibility: "private",
  });
}

/**
 * Hide comment by marking it as deleted
 */
export async function hideComment(commentId: string): Promise<void> {
  await db("feed_comments").where("id", commentId).update({
    deleted_at: db.fn.now(),
  });
}

/**
 * Search users by email, username, or ID
 */
export async function searchUsers(query: SearchUsersQuery): Promise<UserSearchResult[]> {
  const { query: searchQuery, limit = 20, offset = 0 } = query;

  const rows = await db("users as u")
    .leftJoin("profiles as p", "p.user_id", "u.id")
    .leftJoin("user_contacts as c", function () {
      this.on("c.user_id", "=", "u.id")
        .andOn("c.type", "=", db.raw("?", ["email"]))
        .andOn("c.is_primary", "=", db.raw("true"));
    })
    .select(
      "u.id",
      "p.alias as username",
      "c.value as email",
      "u.role_code as roleCode",
      "u.status",
      "u.created_at as createdAt",
    )
    .select(
      db.raw(`(
        SELECT MAX(us.created_at)
        FROM auth_sessions us
        WHERE us.user_id = u.id
      ) as "lastLoginAt"`),
    )
    .select(
      db.raw(`(
        SELECT COUNT(*)
        FROM sessions s
        WHERE s.owner_id = u.id
      ) as "sessionCount"`),
    )
    .select(
      db.raw(`(
        SELECT COUNT(*)
        FROM feed_reports fr
        WHERE fr.feed_item_id IN (
          SELECT id FROM feed_items WHERE owner_id = u.id
        )
        OR fr.comment_id IN (
          SELECT id FROM feed_comments WHERE user_id = u.id
        )
      ) as "reportCount"`),
    )
    .where(function () {
      this.where("c.value", "ilike", `%${searchQuery}%`)
        .orWhere("p.alias", "ilike", `%${searchQuery}%`)
        .orWhere("u.id", "=", searchQuery);
    })
    .whereNull("u.deleted_at")
    .orderBy("u.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return rows as UserSearchResult[];
}

/**
 * Update user status (active, suspended, banned)
 */
export async function updateUserStatus(userId: string, status: UserStatus): Promise<void> {
  await db("users").where("id", userId).update({ status });
}

/**
 * Soft delete a user account
 */
export async function softDeleteUser(userId: string): Promise<void> {
  await db("users").where("id", userId).update({
    deleted_at: db.fn.now(),
    status: "deleted",
  });
}

/**
 * Get user by ID for admin purposes
 */
export async function getUserForAdmin(userId: string): Promise<UserSearchResult | null> {
  const row = (await db<UserSearchResult>("users as u")
    .leftJoin("profiles as p", "p.user_id", "u.id")
    .leftJoin("user_contacts as c", function () {
      this.on("c.user_id", "=", "u.id")
        .andOn("c.type", "=", db.raw("?", ["email"]))
        .andOn("c.is_primary", "=", db.raw("true"));
    })
    .select(
      "u.id",
      "p.alias as username",
      "c.value as email",
      "u.role_code as roleCode",
      "u.status",
      "u.created_at as createdAt",
    )
    .select(
      db.raw(`(
        SELECT MAX(us.created_at)
        FROM auth_sessions us
        WHERE us.user_id = u.id
      ) as "lastLoginAt"`),
    )
    .select(
      db.raw(`(
        SELECT COUNT(*)
        FROM sessions s
        WHERE s.owner_id = u.id
      ) as "sessionCount"`),
    )
    .select(
      db.raw(`(
        SELECT COUNT(*)
        FROM feed_reports fr
        WHERE fr.feed_item_id IN (
          SELECT id FROM feed_items WHERE owner_id = u.id
        )
        OR fr.comment_id IN (
          SELECT id FROM feed_comments WHERE user_id = u.id
        )
      ) as "reportCount"`),
    )
    .where("u.id", userId)
    .whereNull("u.deleted_at")
    .first()) as UserSearchResult | undefined;

  return row ?? null;
}

/**
 * Add email to blacklist
 */
export async function addToBlacklist(
  email: string,
  adminId: string,
  activeTo?: Date | null,
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();

  await db("blacklist").insert({
    email: normalizedEmail,
    active_from: now,
    active_to: activeTo || null,
    created_by: adminId,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Remove email from blacklist (set active_to to now)
 */
export async function removeFromBlacklist(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();

  await db("blacklist")
    .where("email", normalizedEmail)
    .where(function () {
      this.whereNull("active_to").orWhere("active_to", ">", now);
    })
    .update({
      active_to: now,
      updated_at: now,
    });
}

export async function countActiveSessions(): Promise<number> {
  const rows = await db("auth_sessions")
    .distinct("user_id")
    .whereNull("revoked_at")
    .where("expires_at", ">", db.fn.now());

  return rows.length;
}

export async function countOpenMessages(): Promise<number> {
  const row = await db("contact_messages")
    .whereNull("responded_at")
    .count<{ count: string }>("id as count")
    .first();

  return Number(row?.count ?? 0);
}

export async function countPendingReports(): Promise<number> {
  const row = await db("feed_reports")
    .where("status", "pending")
    .count<{ count: string }>("id as count")
    .first();

  return Number(row?.count ?? 0);
}

export async function countUnresolvedAuditLogs(): Promise<number> {
  const row = await db("audit_log")
    .whereNull("resolved_at")
    .count<{ count: string }>("id as count")
    .first();

  return Number(row?.count ?? 0);
}

/**
 * Update user deactivated_at timestamp
 */
export async function updateUserDeactivatedAt(
  userId: string,
  deactivatedAt: Date | null,
): Promise<void> {
  await db("users").where("id", userId).update({
    deactivated_at: deactivatedAt,
    updated_at: db.fn.now(),
  });
}
