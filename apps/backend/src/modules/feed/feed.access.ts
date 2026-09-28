import { HttpError } from "../../utils/http.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import {
  findFeedItemById,
  findSessionById,
  getFeedItemStats,
  hasBlockRelation,
  hasBookmark,
  isFollowing,
  type FeedItemStats,
  type SessionRow,
} from "./feed.repository.js";

export async function loadFeedItemOrThrow(feedItemId: string) {
  const feedItem = await findFeedItemById(feedItemId);
  if (!feedItem) {
    throw new HttpError(404, "E.FEED.ITEM_NOT_FOUND", "FEED_ITEM_NOT_FOUND");
  }
  return feedItem;
}

export async function ensureFeedInteractionAllowed(
  actorId: string,
  ownerId: string,
  visibility: string,
  sessionId?: string | null,
) {
  if (sessionId) {
    const session = await loadSessionOrThrow(sessionId);
    await ensureSessionInteractionAllowed(actorId, session);
    return;
  }

  if (await hasBlockRelation(actorId, ownerId)) {
    throw new HttpError(403, "E.FEED.BLOCKED", "FEED_BLOCKED");
  }
  if (ownerId === actorId || visibility === "public") {
    return;
  }
  if (visibility === "followers" && (await isFollowing(actorId, ownerId))) {
    return;
  }
  throw new HttpError(403, "E.FEED.NOT_PUBLIC", "FEED_NOT_PUBLIC");
}

export async function loadSessionOrThrow(sessionId: string) {
  const session = await findSessionById(sessionId);
  if (!session) {
    throw new HttpError(404, "E.FEED.SESSION_NOT_FOUND", "FEED_SESSION_NOT_FOUND");
  }
  return session;
}

export async function ensureSessionInteractionAllowed(actorId: string, session: SessionRow) {
  if (await hasBlockRelation(actorId, session.owner_id)) {
    throw new HttpError(403, "E.FEED.BLOCKED", "FEED_BLOCKED");
  }
  if (session.owner_id === actorId) {
    return;
  }
  if (await hasBookmark(session.id, actorId)) {
    return;
  }
  if (session.visibility === "public") {
    return;
  }
  if (session.visibility === "followers" && (await isFollowing(actorId, session.owner_id))) {
    return;
  }
  throw new HttpError(403, "E.FEED.NOT_PUBLIC", "Session is not visible to this user");
}

export function loadModerationBlocklist(): string[] {
  return getRuntimeAppSetting<string[]>("moderation.feed_blocked_keywords").map((word) =>
    word.toLowerCase(),
  );
}

export async function fetchStatsForFeedItem(feedItemId: string): Promise<FeedItemStats> {
  const map = await getFeedItemStats([feedItemId]);
  return map.get(feedItemId) ?? { likes: 0, comments: 0 };
}

export function normalizeReason(input: string) {
  const trimmed = (input ?? "").trim();
  if (trimmed.length === 0) {
    throw new HttpError(400, "E.FEED.REPORT_REASON_REQUIRED", "FEED_REPORT_REASON_REQUIRED");
  }
  if (trimmed.length > 200) {
    throw new HttpError(422, "E.FEED.REPORT_REASON_TOO_LONG", "FEED_REPORT_REASON_TOO_LONG");
  }
  return trimmed;
}

export function sanitizeDetails(details?: string | null) {
  if (!details) {
    return null;
  }
  const trimmed = details.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, 500);
}
