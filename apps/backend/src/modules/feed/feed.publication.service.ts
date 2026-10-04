import { insertAudit } from "../common/audit.util.js";
import {
  insertSessionFeedItemAtomic,
  retireSessionFeedItem,
} from "./feed.publication.repository.js";

export async function ensureSessionPublished(
  ownerId: string,
  sessionId: string,
  visibility: "public" | "followers" = "public",
): Promise<{ feedItemId: string; created: boolean }> {
  const result = await insertSessionFeedItemAtomic({
    ownerId,
    sessionId,
    visibility,
  });

  if (result.created) {
    await insertAudit({
      actorUserId: ownerId,
      entityType: "feed_items",
      action: "feed.publish",
      entityId: result.row.id,
      metadata: { session_id: sessionId },
    });
  }

  return { feedItemId: result.row.id, created: result.created };
}

export async function reconcileSessionPublication(
  ownerId: string,
  sessionId: string,
  status: string,
  visibility: string,
): Promise<void> {
  if (status === "completed" && (visibility === "public" || visibility === "followers")) {
    await ensureSessionPublished(ownerId, sessionId, visibility);
    return;
  }
  await retireSessionFeedItem(sessionId);
}
