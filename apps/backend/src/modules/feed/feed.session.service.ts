import { HttpError } from "../../utils/http.js";
import { cloneOne } from "../sessions/sessions.clone.service.js";
import type { SessionWithExercises } from "../sessions/sessions.types.js";
import { loadSessionOrThrow } from "./feed.access.js";
import { ensureSessionPublished } from "./feed.publication.service.js";

export async function cloneSessionFromFeed(
  userId: string,
  sourceSessionId: string,
  payload: Record<string, unknown> = {},
): Promise<SessionWithExercises> {
  return cloneOne(userId, sourceSessionId, {
    ...payload,
  });
}

export async function publishSession(
  userId: string,
  sessionId: string,
): Promise<{ feedItemId: string }> {
  const session = await loadSessionOrThrow(sessionId);

  if (session.owner_id !== userId) {
    throw new HttpError(403, "E.FEED.NOT_OWNER", "FEED_NOT_OWNER");
  }

  if (session.status !== "completed") {
    throw new HttpError(400, "E.FEED.SESSION_NOT_COMPLETED", "FEED_SESSION_NOT_COMPLETED");
  }

  if (session.visibility !== "public" && session.visibility !== "followers") {
    throw new HttpError(400, "E.FEED.SESSION_NOT_PUBLIC", "FEED_SESSION_NOT_PUBLIC");
  }

  const published = await ensureSessionPublished(
    userId,
    sessionId,
    session.visibility as "public" | "followers",
  );
  return { feedItemId: published.feedItemId };
}
