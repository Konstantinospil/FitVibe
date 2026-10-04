import { HttpError } from "../../utils/http.js";
import type { FeedScope, FeedSort } from "./feed.repository.js";
import {
  listFeedSessions,
  countFeedSessions,
  getFeedItemStats,
  findUserLikedFeedItems,
  findUserBookmarkedSessions,
  getLeaderboardRows,
} from "./feed.repository.js";

export interface FeedListResult {
  items: Array<{
    feedItemId: string;
    ownerId: string;
    ownerUsername: string;
    ownerDisplayName: string;
    visibility: string;
    publishedAt: string | null;
    session: null | {
      id: string;
      title: string | null;
      completedAt: string | null;
      points: number | null;
    };
    stats: {
      likes: number;
      comments: number;
      viewerHasLiked: boolean;
      viewerHasBookmarked: boolean;
    };
  }>;
  total: number;
  limit: number;
  offset: number;
}

export async function getFeed({
  viewerId,
  scope = "public",
  limit,
  offset,
  searchQuery,
  sort,
}: {
  viewerId?: string | null;
  scope?: FeedScope;
  limit?: number;
  offset?: number;
  searchQuery?: string | null;
  sort?: FeedSort;
}): Promise<FeedListResult> {
  const normalizedScope: FeedScope = scope === "me" || scope === "following" ? scope : "public";

  if ((normalizedScope === "me" || normalizedScope === "following") && !viewerId) {
    throw new HttpError(401, "E.FEED.AUTH_REQUIRED", "FEED_AUTH_REQUIRED");
  }

  const normalizedLimit = limit ?? 20;
  const normalizedOffset = offset ?? 0;

  // Get total count and items in parallel
  const [total, rows] = await Promise.all([
    countFeedSessions({
      viewerId,
      scope: normalizedScope,
      searchQuery,
    }),
    listFeedSessions({
      viewerId,
      scope: normalizedScope,
      limit: normalizedLimit,
      offset: normalizedOffset,
      searchQuery,
      sort,
    }),
  ]);

  const feedItemIds = rows.map((row) => row.feed_item_id);
  const sessionIds = rows
    .map((row) => row.session_id)
    .filter((value): value is string => Boolean(value));
  const statsMap = await getFeedItemStats(feedItemIds);
  const viewerLikes = viewerId ? await findUserLikedFeedItems(viewerId, feedItemIds) : new Set();
  const viewerBookmarks = viewerId
    ? await findUserBookmarkedSessions(viewerId, sessionIds)
    : new Set();

  return {
    items: rows.map((row) => ({
      feedItemId: row.feed_item_id,
      ownerId: row.owner_id,
      ownerUsername: row.owner_username,
      ownerDisplayName: row.owner_display_name,
      visibility: row.visibility,
      publishedAt: row.published_at,
      session: row.session_id
        ? {
            id: row.session_id,
            title: row.session_title,
            completedAt: row.session_completed_at,
            points: row.session_points,
          }
        : null,
      stats: {
        likes: statsMap.get(row.feed_item_id)?.likes ?? 0,
        comments: statsMap.get(row.feed_item_id)?.comments ?? 0,
        viewerHasLiked: viewerLikes.has(row.feed_item_id),
        viewerHasBookmarked: row.session_id !== null ? viewerBookmarks.has(row.session_id) : false,
      },
    })),
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

export async function getLeaderboard(
  viewerId: string | null,
  options: { scope?: "global" | "friends"; period?: "week" | "month"; limit?: number } = {},
): Promise<
  Array<{
    rank: number;
    user: { id: string; username: string; displayName: string };
    points: number;
    badges: number;
  }>
> {
  const scope = options.scope ?? "global";
  const period = options.period ?? "week";

  if (scope === "friends" && !viewerId) {
    throw new HttpError(
      401,
      "E.FEED.AUTH_REQUIRED",
      "Authentication required for friends leaderboard",
    );
  }

  const rows = await getLeaderboardRows({
    period,
    scope,
    viewerId: scope === "friends" ? (viewerId ?? undefined) : undefined,
    limit: options.limit ?? 25,
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
    },
    points: Number(row.points ?? 0),
    badges: Number(row.badges_count ?? 0),
  }));
}
