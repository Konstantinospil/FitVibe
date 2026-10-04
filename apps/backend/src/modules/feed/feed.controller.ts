import type { Request, Response } from "express";

import { HttpError, readRouteParam } from "../../utils/http.js";
import type { FeedScope, FeedSort } from "./feed.repository.js";
import {
  blockUserByAlias,
  bookmarkSession,
  cloneSessionFromFeed,
  createComment,
  deleteComment,
  followUserByAlias,
  getFeed,
  getLeaderboard,
  likeFeedItem,
  listBookmarks,
  listComments,
  listUserFollowers,
  listUserFollowing,
  publishSession,
  removeBookmark,
  reportComment,
  reportFeedItem,
  unlikeFeedItem,
  unfollowUserByAlias,
  unblockUserByAlias,
} from "./feed.service.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";

// Removed resolveViewerId - all feed endpoints now require authentication per FR-003 (privacy-by-default)
// Authentication is enforced via requireAccessToken middleware in routes

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getQueryValue(input: unknown): string | undefined {
  if (typeof input === "string") {
    return input;
  }
  if (Array.isArray(input)) {
    for (const value of input) {
      if (typeof value === "string") {
        return value;
      }
    }
    return undefined;
  }
  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }
  return undefined;
}

function parseLimit(input: unknown, fallback: number, max: number): number {
  const value = getQueryValue(input);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseOffset(input: unknown, fallback: number): number {
  const value = getQueryValue(input);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export async function getFeedHandler(req: Request, res: Response): Promise<void> {
  // Authentication is required per FR-003 (privacy-by-default)
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const requestedScope = getQueryValue(req.query.scope);
  const limit = parseLimit(req.query.limit, 20, 100);
  const offset = parseOffset(req.query.offset, 0);
  const searchQuery = getQueryValue(req.query.q) || null;
  const requestedSort = getQueryValue(req.query.sort);

  let scope: FeedScope = "public";
  if (requestedScope === "me" || requestedScope === "following") {
    scope = requestedScope;
  }

  let sort: FeedSort = "date";
  if (requestedSort === "popularity" || requestedSort === "relevance") {
    sort = requestedSort;
  }

  const result = await getFeed({
    viewerId: userId,
    scope,
    limit,
    offset,
    searchQuery,
    sort,
  });

  res.json(result);
}

export async function likeFeedItemHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { feedItemId: readRouteParam(req.params.feedItemId, "feedItemId") },
    async () => {
      const result = await likeFeedItem(
        userId,
        readRouteParam(req.params.feedItemId, "feedItemId"),
      );
      return { status: 200, body: result };
    },
  );

  if (!handled) {
    const result = await likeFeedItem(userId, readRouteParam(req.params.feedItemId, "feedItemId"));
    res.json(result);
  }
}

export async function unlikeFeedItemHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { feedItemId: readRouteParam(req.params.feedItemId, "feedItemId") },
    async () => {
      const result = await unlikeFeedItem(
        userId,
        readRouteParam(req.params.feedItemId, "feedItemId"),
      );
      return { status: 200, body: result };
    },
  );

  if (!handled) {
    const result = await unlikeFeedItem(
      userId,
      readRouteParam(req.params.feedItemId, "feedItemId"),
    );
    res.json(result);
  }
}

export async function bookmarkSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { sessionId: readRouteParam(req.params.sessionId, "sessionId") },
    async () => {
      const body = await bookmarkSession(userId, readRouteParam(req.params.sessionId, "sessionId"));
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await bookmarkSession(userId, readRouteParam(req.params.sessionId, "sessionId"));
    res.status(200).json(body);
  }
}

export async function removeBookmarkHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { sessionId: readRouteParam(req.params.sessionId, "sessionId") },
    async () => {
      const body = await removeBookmark(userId, readRouteParam(req.params.sessionId, "sessionId"));
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await removeBookmark(userId, readRouteParam(req.params.sessionId, "sessionId"));
    res.status(200).json(body);
  }
}

export async function listBookmarksHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const limit = parseLimit(req.query.limit, 50, 100);
  const offset = parseOffset(req.query.offset, 0);
  const bookmarks = await listBookmarks(userId, { limit, offset });
  res.json({ bookmarks });
}

export async function listCommentsHandler(req: Request, res: Response): Promise<void> {
  // Authentication required per FR-003 (privacy-by-default)
  const viewerId = req.user?.sub;
  if (!viewerId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const limit = parseLimit(req.query.limit, 50, 200);
  const offset = parseOffset(req.query.offset, 0);
  const comments = await listComments(readRouteParam(req.params.feedItemId, "feedItemId"), {
    limit,
    offset,
    viewerId,
  });
  res.json({ comments });
}

export async function createCommentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const rawBody: unknown = req.body;
  const payload = isRecord(rawBody) ? rawBody : undefined;
  const commentValue = payload?.body;
  const body =
    typeof commentValue === "string"
      ? commentValue
      : commentValue === undefined || commentValue === null
        ? ""
        : typeof commentValue === "number" || typeof commentValue === "boolean"
          ? String(commentValue)
          : commentValue instanceof Date
            ? commentValue.toISOString()
            : (JSON.stringify(commentValue) ?? "");

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { feedItemId: readRouteParam(req.params.feedItemId, "feedItemId"), body },
    async () => {
      const comment = await createComment(
        userId,
        readRouteParam(req.params.feedItemId, "feedItemId"),
        body,
      );
      return { status: 201, body: comment };
    },
  );

  if (!handled) {
    const comment = await createComment(
      userId,
      readRouteParam(req.params.feedItemId, "feedItemId"),
      body,
    );
    res.status(201).json(comment);
  }
}

export async function deleteCommentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { commentId: readRouteParam(req.params.commentId, "commentId") },
    async () => {
      const body = await deleteComment(userId, readRouteParam(req.params.commentId, "commentId"));
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await deleteComment(userId, readRouteParam(req.params.commentId, "commentId"));
    res.status(200).json(body);
  }
}

export async function blockUserHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { alias: readRouteParam(req.params.alias, "alias") },
    async () => {
      const body = await blockUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await blockUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
    res.status(200).json(body);
  }
}

export async function unblockUserHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { alias: readRouteParam(req.params.alias, "alias") },
    async () => {
      const body = await unblockUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await unblockUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
    res.status(200).json(body);
  }
}

export async function reportFeedItemHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const rawBody: unknown = req.body;
  const payload = isRecord(rawBody) ? rawBody : undefined;
  const reasonValue = payload?.reason;
  const detailsValue = payload?.details;
  const reason = typeof reasonValue === "string" ? reasonValue : "";
  const details = typeof detailsValue === "string" ? detailsValue : undefined;

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { feedItemId: readRouteParam(req.params.feedItemId, "feedItemId"), reason, details },
    async () => {
      const body = await reportFeedItem(
        userId,
        readRouteParam(req.params.feedItemId, "feedItemId"),
        reason,
        details,
      );
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await reportFeedItem(
      userId,
      readRouteParam(req.params.feedItemId, "feedItemId"),
      reason,
      details,
    );
    res.status(201).json(body);
  }
}

export async function reportCommentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const rawBody: unknown = req.body;
  const payload = isRecord(rawBody) ? rawBody : undefined;
  const reasonValue = payload?.reason;
  const detailsValue = payload?.details;
  const reason = typeof reasonValue === "string" ? reasonValue : "";
  const details = typeof detailsValue === "string" ? detailsValue : undefined;

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { commentId: readRouteParam(req.params.commentId, "commentId"), reason, details },
    async () => {
      const body = await reportComment(
        userId,
        readRouteParam(req.params.commentId, "commentId"),
        reason,
        details,
      );
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await reportComment(
      userId,
      readRouteParam(req.params.commentId, "commentId"),
      reason,
      details,
    );
    res.status(201).json(body);
  }
}

export async function getLeaderboardHandler(req: Request, res: Response): Promise<void> {
  // Authentication required per FR-003 (privacy-by-default)
  const viewerId = req.user?.sub;
  if (!viewerId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const requestedScope = req.query.scope as string | undefined;
  const scope = requestedScope === "friends" ? "friends" : "global";
  const period = (req.query.period as "week" | "month" | undefined) ?? "week";
  const limit = parseLimit(req.query.limit, 25, 100);
  const leaderboard = await getLeaderboard(viewerId, { scope, period, limit });
  res.json({ leaderboard, scope, period });
}

export async function cloneSessionFromFeedHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const rawBody: unknown = req.body;
  const payload: Record<string, unknown> = isRecord(rawBody) ? rawBody : {};

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { sessionId: readRouteParam(req.params.sessionId, "sessionId"), ...payload },
    async () => {
      const body = await cloneSessionFromFeed(
        userId,
        readRouteParam(req.params.sessionId, "sessionId"),
        payload,
      );
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await cloneSessionFromFeed(
      userId,
      readRouteParam(req.params.sessionId, "sessionId"),
      payload,
    );
    res.status(201).json(body);
  }
}

export async function followUserHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { alias: readRouteParam(req.params.alias, "alias") },
    async () => {
      const result = await followUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
      const body = { followingId: result.followingId };
      return { status: 200, body };
    },
  );

  if (!handled) {
    const result = await followUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
    res.status(200).json({ followingId: result.followingId });
  }
}

export async function unfollowUserHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { alias: readRouteParam(req.params.alias, "alias") },
    async () => {
      const result = await unfollowUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
      const body = { unfollowedId: result.unfollowedId };
      return { status: 200, body };
    },
  );

  if (!handled) {
    const result = await unfollowUserByAlias(userId, readRouteParam(req.params.alias, "alias"));
    res.status(200).json({ unfollowedId: result.unfollowedId });
  }
}

export async function listFollowersHandler(req: Request, res: Response): Promise<void> {
  const rows = await listUserFollowers(readRouteParam(req.params.alias, "alias"));
  res.json({ followers: rows });
}

export async function listFollowingHandler(req: Request, res: Response): Promise<void> {
  const rows = await listUserFollowing(readRouteParam(req.params.alias, "alias"));
  res.json({ following: rows });
}

export async function publishSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "UNAUTHENTICATED");
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { sessionId: readRouteParam(req.params.sessionId, "sessionId") },
    async () => {
      const body = await publishSession(userId, readRouteParam(req.params.sessionId, "sessionId"));
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await publishSession(userId, readRouteParam(req.params.sessionId, "sessionId"));
    res.status(201).json(body);
  }
}
