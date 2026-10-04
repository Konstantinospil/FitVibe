import { db } from "../../db/connection.js";

const FEED_ITEMS_TABLE = "feed_items";
const SESSIONS_TABLE = "sessions";

export interface SessionRow {
  id: string;
  owner_id: string;
  visibility: string;
  status: string;
  completed_at: string | null;
}
export async function findSessionById(sessionId: string): Promise<SessionRow | undefined> {
  return db<SessionRow>(SESSIONS_TABLE)
    .select(["id", "owner_id", "visibility", "status", "completed_at"])
    .where({ id: sessionId })
    .whereNull("deleted_at")
    .first();
}

export interface FeedItemRow {
  id: string;
  owner_id: string;
  session_id: string | null;
  visibility: string;
  published_at: string | null;
}

export async function findFeedItemBySessionId(sessionId: string): Promise<FeedItemRow | undefined> {
  return db<FeedItemRow>(FEED_ITEMS_TABLE)
    .select(["id", "owner_id", "session_id", "visibility", "published_at"])
    .where({ session_id: sessionId })
    .whereNull("deleted_at")
    .first();
}

export interface CreateFeedItemInput {
  ownerId: string;
  sessionId?: string | null;
  visibility: string;
  publishedAt?: Date | string | null;
}

export async function insertFeedItem({
  ownerId,
  sessionId = null,
  visibility,
  publishedAt,
}: CreateFeedItemInput): Promise<FeedItemRow> {
  const [row] = await db(FEED_ITEMS_TABLE)
    .insert({
      owner_id: ownerId,
      session_id: sessionId ?? null,
      visibility,
      published_at: publishedAt ?? db.fn.now(),
    })
    .returning<FeedItemRow[]>(["id", "owner_id", "session_id", "visibility", "published_at"]);
  return row;
}

export async function insertSessionFeedItemAtomic({
  ownerId,
  sessionId,
  visibility,
}: {
  ownerId: string;
  sessionId: string;
  visibility: string;
}): Promise<{ row: FeedItemRow; created: boolean }> {
  const inserted = await db(FEED_ITEMS_TABLE)
    .insert({
      owner_id: ownerId,
      session_id: sessionId,
      visibility,
      published_at: db.fn.now(),
    })
    .onConflict("session_id")
    .ignore()
    .returning<FeedItemRow[]>(["id", "owner_id", "session_id", "visibility", "published_at"]);

  if (inserted.length > 0) {
    return { row: inserted[0], created: true };
  }

  const existing = await findFeedItemBySessionId(sessionId);
  if (existing) {
    if (existing.visibility === visibility) {
      return { row: existing, created: false };
    }
    const [updated] = await db(FEED_ITEMS_TABLE)
      .where({ id: existing.id })
      .whereNull("deleted_at")
      .update({
        owner_id: ownerId,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .returning<FeedItemRow[]>(["id", "owner_id", "session_id", "visibility", "published_at"]);
    return { row: updated ?? existing, created: false };
  }

  const reactivated = await db(FEED_ITEMS_TABLE)
    .where({ session_id: sessionId })
    .whereNotNull("deleted_at")
    .update({
      owner_id: ownerId,
      visibility,
      published_at: db.fn.now(),
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .returning<FeedItemRow[]>(["id", "owner_id", "session_id", "visibility", "published_at"]);

  if (reactivated.length > 0) {
    return { row: reactivated[0], created: true };
  }

  const concurrentlyRestored = await findFeedItemBySessionId(sessionId);
  if (!concurrentlyRestored) {
    throw new Error("Feed item uniqueness conflict without an existing or restorable row");
  }
  return { row: concurrentlyRestored, created: false };
}

export async function findFeedItemById(feedItemId: string): Promise<FeedItemRow | undefined> {
  return db<FeedItemRow>(FEED_ITEMS_TABLE)
    .select(["id", "owner_id", "session_id", "visibility", "published_at"])
    .where({ id: feedItemId })
    .whereNull("deleted_at")
    .first();
}

export async function updateFeedItem(
  feedItemId: string,
  patch: Partial<{ visibility: string; published_at: Date | string | null }>,
): Promise<void> {
  if (Object.keys(patch).length === 0) {
    return;
  }
  await db(FEED_ITEMS_TABLE)
    .where({ id: feedItemId })
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    });
}

export async function retireSessionFeedItem(sessionId: string): Promise<boolean> {
  const affected = await db(FEED_ITEMS_TABLE)
    .where({ session_id: sessionId })
    .whereNull("deleted_at")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  return affected > 0;
}
