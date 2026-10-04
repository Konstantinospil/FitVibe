import { db } from "../../db/connection.js";

const FEED_ITEMS_TABLE = "feed_items";
const SESSIONS_TABLE = "sessions";
const USERS_TABLE = "users";
const PROFILES_TABLE = "profiles";
const FEED_LIKES_TABLE = "feed_likes";
const SESSION_BOOKMARKS_TABLE = "session_bookmarks";
const FEED_COMMENTS_TABLE = "feed_comments";
const USER_BLOCKS_TABLE = "user_blocks";
const FEED_REPORTS_TABLE = "feed_reports";

export async function upsertFeedLike(feedItemId: string, userId: string): Promise<boolean> {
  const insertQuery = db(FEED_LIKES_TABLE)
    .insert({
      feed_item_id: feedItemId,
      user_id: userId,
    })
    .onConflict(["feed_item_id", "user_id"])
    .ignore();
  const result = await insertQuery;
  if (Array.isArray(result)) {
    return result.length > 0;
  }
  if (typeof result === "number") {
    return result > 0;
  }
  return true;
}

export async function deleteFeedLike(feedItemId: string, userId: string): Promise<number> {
  return db(FEED_LIKES_TABLE).where({ feed_item_id: feedItemId, user_id: userId }).del();
}

export interface FeedItemStats {
  likes: number;
  comments: number;
}

export async function getFeedItemStats(feedItemIds: string[]): Promise<Map<string, FeedItemStats>> {
  const map = new Map<string, FeedItemStats>();
  if (feedItemIds.length === 0) {
    return map;
  }
  for (const id of feedItemIds) {
    map.set(id, { likes: 0, comments: 0 });
  }
  const likeRows = await db(FEED_LIKES_TABLE)
    .whereIn("feed_item_id", feedItemIds)
    .groupBy("feed_item_id")
    .select<{ feed_item_id: string; count: string | number }[]>([
      "feed_item_id",
      db.raw("COUNT(*) as count"),
    ]);
  for (const row of likeRows) {
    const stats = map.get(row.feed_item_id);
    if (stats) {
      stats.likes = Number(row.count ?? 0);
    }
  }
  const commentRows = await db(FEED_COMMENTS_TABLE)
    .whereIn("feed_item_id", feedItemIds)
    .whereNull("deleted_at")
    .groupBy("feed_item_id")
    .select<{ feed_item_id: string; count: string | number }[]>([
      "feed_item_id",
      db.raw("COUNT(*) as count"),
    ]);
  for (const row of commentRows) {
    const stats = map.get(row.feed_item_id);
    if (stats) {
      stats.comments = Number(row.count ?? 0);
    }
  }
  return map;
}

export async function findUserLikedFeedItems(
  userId: string,
  feedItemIds: string[],
): Promise<Set<string>> {
  if (!userId || feedItemIds.length === 0) {
    return new Set();
  }
  const rows = await db(FEED_LIKES_TABLE)
    .where({ user_id: userId })
    .whereIn("feed_item_id", feedItemIds)
    .select<{ feed_item_id: string }[]>("feed_item_id");
  return new Set(rows.map((row) => row.feed_item_id));
}

export async function upsertBookmark(sessionId: string, userId: string): Promise<boolean> {
  const insertQuery = db(SESSION_BOOKMARKS_TABLE)
    .insert({
      session_id: sessionId,
      user_id: userId,
    })
    .onConflict(["session_id", "user_id"])
    .ignore();
  const result = await insertQuery;
  if (Array.isArray(result)) {
    return result.length > 0;
  }
  if (typeof result === "number") {
    return result > 0;
  }
  return true;
}

export async function deleteBookmark(sessionId: string, userId: string): Promise<number> {
  return db(SESSION_BOOKMARKS_TABLE).where({ session_id: sessionId, user_id: userId }).del();
}

export async function hasBookmark(sessionId: string, userId: string): Promise<boolean> {
  const row = await db<{ session_id: string; user_id: string }>(SESSION_BOOKMARKS_TABLE)
    .select("session_id")
    .where({ session_id: sessionId, user_id: userId })
    .first();
  return Boolean(row);
}

export async function findUserBookmarkedSessions(
  userId: string,
  sessionIds: string[],
): Promise<Set<string>> {
  if (!userId || sessionIds.length === 0) {
    return new Set();
  }
  const rows = await db(SESSION_BOOKMARKS_TABLE)
    .where({ user_id: userId })
    .whereIn("session_id", sessionIds)
    .select<{ session_id: string }[]>("session_id");
  return new Set(rows.map((row) => row.session_id));
}

export interface BookmarkRow {
  session_id: string;
  feed_item_id: string | null;
  title: string | null;
  completed_at: string | null;
  visibility: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  created_at: string;
  points: number | null;
}

export async function listBookmarkedSessions(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<BookmarkRow[]> {
  return db(SESSION_BOOKMARKS_TABLE)
    .join(SESSIONS_TABLE, `${SESSIONS_TABLE}.id`, `${SESSION_BOOKMARKS_TABLE}.session_id`)
    .leftJoin(FEED_ITEMS_TABLE, function joinActiveFeedItem() {
      this.on(
        `${FEED_ITEMS_TABLE}.session_id`,
        "=",
        `${SESSION_BOOKMARKS_TABLE}.session_id`,
      ).andOnNull(`${FEED_ITEMS_TABLE}.deleted_at`);
    })
    .join(USERS_TABLE, `${USERS_TABLE}.id`, `${SESSIONS_TABLE}.owner_id`)
    .join(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${SESSIONS_TABLE}.owner_id`)
    .select<BookmarkRow[]>([
      `${SESSION_BOOKMARKS_TABLE}.session_id`,
      `${FEED_ITEMS_TABLE}.id as feed_item_id`,
      `${SESSIONS_TABLE}.title`,
      `${SESSIONS_TABLE}.completed_at`,
      `${SESSIONS_TABLE}.visibility`,
      `${SESSIONS_TABLE}.owner_id`,
      `${PROFILES_TABLE}.alias as owner_username`,
      `${USERS_TABLE}.display_name as owner_display_name`,
      `${SESSION_BOOKMARKS_TABLE}.created_at`,
      `${SESSIONS_TABLE}.points`,
    ])
    .where({ [`${SESSION_BOOKMARKS_TABLE}.user_id`]: userId })
    .whereNull(`${SESSIONS_TABLE}.deleted_at`)
    .whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocker_id`, userId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocked_id = ${SESSIONS_TABLE}.owner_id`),
    )
    .whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocked_id`, userId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocker_id = ${SESSIONS_TABLE}.owner_id`),
    )
    .orderBy(`${SESSION_BOOKMARKS_TABLE}.created_at`, "desc")
    .limit(limit)
    .offset(offset);
}

export interface CommentRow {
  id: string;
  feed_item_id: string;
  user_id: string;
  username: string;
  display_name: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export async function listCommentsForFeedItem(
  feedItemId: string,
  limit = 50,
  offset = 0,
): Promise<CommentRow[]> {
  return db(FEED_COMMENTS_TABLE)
    .join(USERS_TABLE, `${USERS_TABLE}.id`, `${FEED_COMMENTS_TABLE}.user_id`)
    .join(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${FEED_COMMENTS_TABLE}.user_id`)
    .select<CommentRow[]>([
      `${FEED_COMMENTS_TABLE}.id`,
      `${FEED_COMMENTS_TABLE}.feed_item_id`,
      `${FEED_COMMENTS_TABLE}.user_id`,
      `${PROFILES_TABLE}.alias as username`,
      `${USERS_TABLE}.display_name`,
      `${FEED_COMMENTS_TABLE}.body`,
      `${FEED_COMMENTS_TABLE}.created_at`,
      `${FEED_COMMENTS_TABLE}.edited_at`,
    ])
    .where({ [`${FEED_COMMENTS_TABLE}.feed_item_id`]: feedItemId })
    .whereNull(`${FEED_COMMENTS_TABLE}.deleted_at`)
    .orderBy(`${FEED_COMMENTS_TABLE}.created_at`, "asc")
    .limit(limit)
    .offset(offset);
}

export interface InsertCommentInput {
  feedItemId: string;
  userId: string;
  body: string;
  parentId?: string | null;
}

export async function insertComment({
  feedItemId,
  userId,
  body,
  parentId = null,
}: InsertCommentInput) {
  const [row] = await db(FEED_COMMENTS_TABLE)
    .insert({
      feed_item_id: feedItemId,
      user_id: userId,
      parent_id: parentId,
      body,
    })
    .returning<CommentRow[]>(["id", "feed_item_id", "user_id", "body", "created_at", "edited_at"]);
  return row;
}

export interface FeedCommentRecord {
  id: string;
  feed_item_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export async function findCommentById(commentId: string): Promise<FeedCommentRecord | undefined> {
  return db<FeedCommentRecord>(FEED_COMMENTS_TABLE).select("*").where({ id: commentId }).first();
}

export async function getCommentWithAuthor(commentId: string): Promise<CommentRow | undefined> {
  return db(FEED_COMMENTS_TABLE)
    .join(USERS_TABLE, `${USERS_TABLE}.id`, `${FEED_COMMENTS_TABLE}.user_id`)
    .join(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${FEED_COMMENTS_TABLE}.user_id`)
    .select<CommentRow[]>([
      `${FEED_COMMENTS_TABLE}.id`,
      `${FEED_COMMENTS_TABLE}.feed_item_id`,
      `${FEED_COMMENTS_TABLE}.user_id`,
      `${PROFILES_TABLE}.alias as username`,
      `${USERS_TABLE}.display_name`,
      `${FEED_COMMENTS_TABLE}.body`,
      `${FEED_COMMENTS_TABLE}.created_at`,
      `${FEED_COMMENTS_TABLE}.edited_at`,
    ])
    .where({ [`${FEED_COMMENTS_TABLE}.id`]: commentId })
    .whereNull(`${FEED_COMMENTS_TABLE}.deleted_at`)
    .first();
}

export async function softDeleteComment(commentId: string): Promise<number> {
  return db(FEED_COMMENTS_TABLE)
    .where({ id: commentId })
    .update({ deleted_at: new Date().toISOString() });
}

export interface FeedReportInsert {
  reporterId: string;
  feedItemId?: string | null;
  commentId?: string | null;
  reason: string;
  details?: string | null;
}

export async function insertFeedReport({
  reporterId,
  feedItemId = null,
  commentId = null,
  reason,
  details = null,
}: FeedReportInsert) {
  return db(FEED_REPORTS_TABLE).insert({
    reporter_id: reporterId,
    feed_item_id: feedItemId,
    comment_id: commentId,
    reason,
    details,
  });
}
