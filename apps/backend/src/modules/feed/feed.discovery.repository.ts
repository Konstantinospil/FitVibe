import { db } from "../../db/connection.js";

const FEED_ITEMS_TABLE = "feed_items";
const SESSIONS_TABLE = "sessions";
const USERS_TABLE = "users";
const PROFILES_TABLE = "profiles";
const FOLLOWERS_TABLE = "followers";
const FEED_LIKES_TABLE = "feed_likes";
const USER_BLOCKS_TABLE = "user_blocks";
const SESSION_EXERCISES_TABLE = "session_exercises";

export type FeedScope = "public" | "me" | "following";
export type FeedSort = "date" | "popularity" | "relevance";

export interface FeedQueryOptions {
  viewerId?: string | null;
  scope: FeedScope;
  limit?: number;
  offset?: number;
  searchQuery?: string | null;
  sort?: FeedSort;
}

export interface FeedItemWithSessionRow {
  feed_item_id: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  visibility: string;
  published_at: string | null;
  session_id: string | null;
  session_title: string | null;
  session_completed_at: string | null;
  session_points: number | null;
}

export async function listFeedSessions({
  viewerId,
  scope,
  limit = 20,
  offset = 0,
  searchQuery,
  sort = "date",
}: FeedQueryOptions): Promise<FeedItemWithSessionRow[]> {
  const query = db(FEED_ITEMS_TABLE)
    .leftJoin(SESSIONS_TABLE, `${SESSIONS_TABLE}.id`, `${FEED_ITEMS_TABLE}.session_id`)
    .leftJoin(USERS_TABLE, `${USERS_TABLE}.id`, `${FEED_ITEMS_TABLE}.owner_id`)
    .leftJoin(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${FEED_ITEMS_TABLE}.owner_id`);

  // For popularity sorting, we need to join with feed_likes to count likes
  if (sort === "popularity") {
    query.leftJoin(FEED_LIKES_TABLE, `${FEED_LIKES_TABLE}.feed_item_id`, `${FEED_ITEMS_TABLE}.id`);
  }

  // For search, we need to join with session_exercises to search exercise names
  if (searchQuery) {
    query.leftJoin(
      SESSION_EXERCISES_TABLE,
      `${SESSION_EXERCISES_TABLE}.session_id`,
      `${SESSIONS_TABLE}.id`,
    );
  }

  query
    .select<FeedItemWithSessionRow[]>([
      `${FEED_ITEMS_TABLE}.id as feed_item_id`,
      `${FEED_ITEMS_TABLE}.owner_id`,
      `${PROFILES_TABLE}.alias as owner_username`,
      `${USERS_TABLE}.display_name as owner_display_name`,
      `${SESSIONS_TABLE}.visibility`,
      `${FEED_ITEMS_TABLE}.published_at`,
      `${SESSIONS_TABLE}.id as session_id`,
      `${SESSIONS_TABLE}.title as session_title`,
      `${SESSIONS_TABLE}.completed_at as session_completed_at`,
      `${SESSIONS_TABLE}.points as session_points`,
    ])
    .whereNull(`${FEED_ITEMS_TABLE}.deleted_at`)
    .whereNull(`${SESSIONS_TABLE}.deleted_at`)
    .where(`${SESSIONS_TABLE}.status`, "completed");

  // Apply search query if provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = `%${searchQuery.trim().toLowerCase()}%`;
    query.where((builder) => {
      builder
        .whereRaw(`LOWER(${SESSIONS_TABLE}.title) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${SESSION_EXERCISES_TABLE}.exercise_name) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${PROFILES_TABLE}.alias) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${USERS_TABLE}.display_name) LIKE ?`, [searchTerm]);
    });
  }

  // Apply sorting
  if (sort === "popularity") {
    query
      .groupBy([
        `${FEED_ITEMS_TABLE}.id`,
        `${FEED_ITEMS_TABLE}.owner_id`,
        `${PROFILES_TABLE}.alias`,
        `${USERS_TABLE}.display_name`,
        `${SESSIONS_TABLE}.visibility`,
        `${FEED_ITEMS_TABLE}.published_at`,
        `${SESSIONS_TABLE}.id`,
        `${SESSIONS_TABLE}.title`,
        `${SESSIONS_TABLE}.completed_at`,
        `${SESSIONS_TABLE}.points`,
      ])
      .orderByRaw(`COUNT(${FEED_LIKES_TABLE}.feed_item_id) DESC`)
      .orderBy(`${FEED_ITEMS_TABLE}.published_at`, "desc");
  } else if (sort === "relevance") {
    // Relevance sorting: prioritize matches in title, then exercise names, then user aliases
    // For now, we'll use date as a fallback since true relevance requires full-text search
    query.orderBy(`${FEED_ITEMS_TABLE}.published_at`, "desc");
  } else {
    // Default: sort by date
    query
      .orderBy(`${FEED_ITEMS_TABLE}.published_at`, "desc")
      .orderBy(`${FEED_ITEMS_TABLE}.created_at`, "desc");
  }

  query.limit(limit).offset(offset);

  if (viewerId) {
    query.whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocker_id`, viewerId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocked_id = ${FEED_ITEMS_TABLE}.owner_id`),
    );
    query.whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocked_id`, viewerId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocker_id = ${FEED_ITEMS_TABLE}.owner_id`),
    );
  }

  if (scope === "public") {
    query.where(`${SESSIONS_TABLE}.visibility`, "public");
  } else if (scope === "me") {
    if (!viewerId) {
      return [];
    }
    query.where(`${FEED_ITEMS_TABLE}.owner_id`, viewerId);
  } else if (scope === "following") {
    if (!viewerId) {
      return [];
    }
    query.whereIn(`${FEED_ITEMS_TABLE}.owner_id`, (builder) => {
      builder.select("following_id").from(FOLLOWERS_TABLE).where({ follower_id: viewerId });
    });
    query.whereIn(`${SESSIONS_TABLE}.visibility`, ["public", "followers"]);
  }

  return query;
}

export async function countFeedSessions({
  viewerId,
  scope,
  searchQuery,
}: {
  viewerId?: string | null;
  scope: FeedScope;
  searchQuery?: string | null;
}): Promise<number> {
  const query = db(FEED_ITEMS_TABLE)
    .leftJoin(SESSIONS_TABLE, `${SESSIONS_TABLE}.id`, `${FEED_ITEMS_TABLE}.session_id`)
    .leftJoin(USERS_TABLE, `${USERS_TABLE}.id`, `${FEED_ITEMS_TABLE}.owner_id`)
    .leftJoin(PROFILES_TABLE, `${PROFILES_TABLE}.user_id`, `${FEED_ITEMS_TABLE}.owner_id`);

  // For search, we need to join with session_exercises to search exercise names
  if (searchQuery) {
    query.leftJoin(
      SESSION_EXERCISES_TABLE,
      `${SESSION_EXERCISES_TABLE}.session_id`,
      `${SESSIONS_TABLE}.id`,
    );
  }

  query
    .whereNull(`${FEED_ITEMS_TABLE}.deleted_at`)
    .whereNull(`${SESSIONS_TABLE}.deleted_at`)
    .where(`${SESSIONS_TABLE}.status`, "completed");

  // Apply search query if provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = `%${searchQuery.trim().toLowerCase()}%`;
    query.where((builder) => {
      builder
        .whereRaw(`LOWER(${SESSIONS_TABLE}.title) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${SESSION_EXERCISES_TABLE}.exercise_name) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${PROFILES_TABLE}.alias) LIKE ?`, [searchTerm])
        .orWhereRaw(`LOWER(${USERS_TABLE}.display_name) LIKE ?`, [searchTerm]);
    });
  }

  if (viewerId) {
    query.whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocker_id`, viewerId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocked_id = ${FEED_ITEMS_TABLE}.owner_id`),
    );
    query.whereNotExists(
      db(USER_BLOCKS_TABLE)
        .select(1)
        .where(`${USER_BLOCKS_TABLE}.blocked_id`, viewerId)
        .whereRaw(`${USER_BLOCKS_TABLE}.blocker_id = ${FEED_ITEMS_TABLE}.owner_id`),
    );
  }

  if (scope === "public") {
    query.where(`${SESSIONS_TABLE}.visibility`, "public");
  } else if (scope === "me") {
    if (!viewerId) {
      return 0;
    }
    query.where(`${FEED_ITEMS_TABLE}.owner_id`, viewerId);
  } else if (scope === "following") {
    if (!viewerId) {
      return 0;
    }
    query.whereIn(`${FEED_ITEMS_TABLE}.owner_id`, (builder) => {
      builder.select("following_id").from(FOLLOWERS_TABLE).where({ follower_id: viewerId });
    });
    query.whereIn(`${SESSIONS_TABLE}.visibility`, ["public", "followers"]);
  }

  // For count, we need to use distinct on feed_item_id to avoid duplicates from joins
  const result = await query
    .countDistinct(`${FEED_ITEMS_TABLE}.id as count`)
    .first<{ count: string | number }>();

  if (!result) {
    return 0;
  }

  return typeof result.count === "string" ? parseInt(result.count, 10) : result.count;
}
