import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  upsertFeedLike,
  deleteFeedLike,
  upsertBookmark,
  deleteBookmark,
  listBookmarkedSessions,
  listCommentsForFeedItem,
  insertComment,
  findCommentById,
  getCommentWithAuthor,
  softDeleteComment,
  insertFeedReport,
  type FeedItemStats,
} from "./feed.repository.js";
import {
  ensureFeedInteractionAllowed,
  ensureSessionInteractionAllowed,
  fetchStatsForFeedItem,
  loadFeedItemOrThrow,
  loadModerationBlocklist,
  loadSessionOrThrow,
  normalizeReason,
  sanitizeDetails,
} from "./feed.access.js";

export async function likeFeedItem(
  userId: string,
  feedItemId: string,
): Promise<{ liked: boolean; stats: FeedItemStats }> {
  const feedItem = await loadFeedItemOrThrow(feedItemId);
  await ensureFeedInteractionAllowed(
    userId,
    feedItem.owner_id,
    feedItem.visibility,
    feedItem.session_id,
  );

  await upsertFeedLike(feedItemId, userId);
  const stats = await fetchStatsForFeedItem(feedItemId);

  await insertAudit({
    actorUserId: userId,
    entityType: "feed_items",
    action: "feed.like",
    entityId: feedItemId,
    metadata: {
      owner_id: feedItem.owner_id,
    },
  });

  return { liked: true, stats };
}

export async function unlikeFeedItem(
  userId: string,
  feedItemId: string,
): Promise<{ liked: boolean; stats: FeedItemStats }> {
  const feedItem = await loadFeedItemOrThrow(feedItemId);
  await ensureFeedInteractionAllowed(
    userId,
    feedItem.owner_id,
    feedItem.visibility,
    feedItem.session_id,
  );

  const removed = await deleteFeedLike(feedItemId, userId);
  const stats = await fetchStatsForFeedItem(feedItemId);

  if (removed > 0) {
    await insertAudit({
      actorUserId: userId,
      entityType: "feed_items",
      action: "feed.unlike",
      entityId: feedItemId,
      metadata: {
        owner_id: feedItem.owner_id,
      },
    });
  }

  return { liked: false, stats };
}

export async function bookmarkSession(
  userId: string,
  sessionId: string,
): Promise<{ bookmarked: boolean }> {
  const session = await loadSessionOrThrow(sessionId);
  await ensureSessionInteractionAllowed(userId, session);

  await upsertBookmark(sessionId, userId);

  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action: "feed.bookmark",
    entityId: sessionId,
    metadata: {
      owner_id: session.owner_id,
    },
  });

  return { bookmarked: true };
}

export async function removeBookmark(
  userId: string,
  sessionId: string,
): Promise<{ bookmarked: boolean }> {
  const session = await loadSessionOrThrow(sessionId);
  const removed = await deleteBookmark(sessionId, userId);
  if (removed > 0) {
    await insertAudit({
      actorUserId: userId,
      entityType: "sessions",
      action: "feed.unbookmark",
      entityId: sessionId,
      metadata: {
        owner_id: session.owner_id,
      },
    });
  }

  return { bookmarked: false };
}

export async function listBookmarks(
  userId: string,
  options: { limit?: number; offset?: number },
): Promise<
  Array<{
    sessionId: string;
    feedItemId: string | null;
    title: string | null;
    completedAt: string | null;
    visibility: string;
    owner: { id: string; username: string; displayName: string };
    points: number | null;
    bookmarkedAt: string;
  }>
> {
  const rows = await listBookmarkedSessions(userId, options.limit, options.offset);
  return rows.map((row) => ({
    sessionId: row.session_id,
    feedItemId: row.feed_item_id,
    title: row.title,
    completedAt: row.completed_at,
    visibility: row.visibility,
    owner: {
      id: row.owner_id,
      username: row.owner_username,
      displayName: row.owner_display_name,
    },
    points: row.points ?? null,
    bookmarkedAt: row.created_at,
  }));
}

export async function listComments(
  feedItemId: string,
  options: { limit?: number; offset?: number; viewerId?: string } = {},
): Promise<
  Array<{
    id: string;
    feedItemId: string;
    author: { id: string; username: string; displayName: string };
    body: string;
    createdAt: string;
    editedAt: string | null;
  }>
> {
  const feedItem = await loadFeedItemOrThrow(feedItemId);
  if (options.viewerId) {
    await ensureFeedInteractionAllowed(
      options.viewerId,
      feedItem.owner_id,
      feedItem.visibility,
      feedItem.session_id,
    );
  } else if (feedItem.visibility !== "public") {
    throw new HttpError(403, "E.FEED.NOT_PUBLIC", "FEED_NOT_PUBLIC");
  }

  const rows = await listCommentsForFeedItem(feedItemId, options.limit, options.offset);

  return rows.map((row) => ({
    id: row.id,
    feedItemId: row.feed_item_id,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
    },
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  }));
}

export async function createComment(
  userId: string,
  feedItemId: string,
  body: string,
): Promise<{
  id: string;
  feedItemId: string;
  author: { id: string; username: string; displayName: string };
  body: string;
  createdAt: string;
  editedAt: string | null;
}> {
  const feedItem = await loadFeedItemOrThrow(feedItemId);
  await ensureFeedInteractionAllowed(
    userId,
    feedItem.owner_id,
    feedItem.visibility,
    feedItem.session_id,
  );

  const trimmed = (body ?? "").trim();
  if (trimmed.length === 0) {
    throw new HttpError(400, "E.SOCIAL.COMMENT_EMPTY", "SOCIAL_COMMENT_EMPTY");
  }
  if (trimmed.length > 500) {
    throw new HttpError(422, "E.SOCIAL.COMMENT_TOO_LONG", "SOCIAL_COMMENT_TOO_LONG");
  }

  const blocklist = loadModerationBlocklist();
  const lower = trimmed.toLowerCase();
  const flagged = blocklist.find((word) => lower.includes(word));
  if (flagged) {
    throw new HttpError(422, "E.SOCIAL.COMMENT_FORBIDDEN", "SOCIAL_COMMENT_FORBIDDEN");
  }

  const inserted = await insertComment({
    feedItemId,
    userId,
    body: trimmed,
  });

  const enriched = await getCommentWithAuthor(inserted.id);
  if (!enriched) {
    throw new HttpError(500, "E.SOCIAL.COMMENT_LOAD_FAILED", "SOCIAL_COMMENT_LOAD_FAILED");
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "feed_items",
    action: "feed.comment",
    entityId: feedItemId,
    metadata: {
      comment_id: inserted.id,
    },
  });

  return {
    id: enriched.id,
    feedItemId: enriched.feed_item_id,
    author: {
      id: enriched.user_id,
      username: enriched.username,
      displayName: enriched.display_name,
    },
    body: enriched.body,
    createdAt: enriched.created_at,
    editedAt: enriched.edited_at,
  };
}

export async function deleteComment(
  userId: string,
  commentId: string,
): Promise<{ deleted: boolean }> {
  const comment = await findCommentById(commentId);
  if (!comment || comment.deleted_at) {
    return { deleted: false };
  }
  const feedItem = await loadFeedItemOrThrow(comment.feed_item_id);

  if (comment.user_id !== userId && feedItem.owner_id !== userId) {
    throw new HttpError(403, "E.SOCIAL.COMMENT_FORBIDDEN", "SOCIAL_COMMENT_FORBIDDEN");
  }

  await softDeleteComment(commentId);
  await insertAudit({
    actorUserId: userId,
    entityType: "feed_items",
    action: "feed.comment.delete",
    entityId: comment.feed_item_id,
    metadata: {
      comment_id: commentId,
    },
  });

  return { deleted: true };
}

export async function reportFeedItem(
  reporterId: string,
  feedItemId: string,
  reason: string,
  details?: string,
): Promise<{ reported: boolean }> {
  const feedItem = await loadFeedItemOrThrow(feedItemId);
  await ensureFeedInteractionAllowed(reporterId, feedItem.owner_id, feedItem.visibility);

  const normalizedReason = normalizeReason(reason);
  const sanitizedDetails = sanitizeDetails(details);

  await insertFeedReport({
    reporterId,
    feedItemId,
    reason: normalizedReason,
    details: sanitizedDetails,
  });

  await insertAudit({
    actorUserId: reporterId,
    entityType: "feed_items",
    action: "feed.report.item",
    entityId: feedItemId,
    metadata: {
      reason: normalizedReason,
    },
  });

  return { reported: true };
}

export async function reportComment(
  reporterId: string,
  commentId: string,
  reason: string,
  details?: string,
): Promise<{ reported: boolean }> {
  const comment = await findCommentById(commentId);
  if (!comment || comment.deleted_at) {
    throw new HttpError(404, "E.FEED.COMMENT_NOT_FOUND", "FEED_COMMENT_NOT_FOUND");
  }
  const feedItem = await loadFeedItemOrThrow(comment.feed_item_id);
  await ensureFeedInteractionAllowed(reporterId, feedItem.owner_id, feedItem.visibility);

  const normalizedReason = normalizeReason(reason);
  const sanitizedDetails = sanitizeDetails(details);

  await insertFeedReport({
    reporterId,
    feedItemId: comment.feed_item_id,
    commentId,
    reason: normalizedReason,
    details: sanitizedDetails,
  });

  await insertAudit({
    actorUserId: reporterId,
    entityType: "feed_items",
    action: "feed.report.comment",
    entityId: comment.feed_item_id,
    metadata: {
      comment_id: commentId,
      reason: normalizedReason,
    },
  });

  return { reported: true };
}
