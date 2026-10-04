import { HttpError } from "../../utils/http.js";
import { logger } from "../../config/logger.js";
import { insertAudit } from "../common/audit.util.js";
import { evaluateBadgesForFollow } from "../points/badges.service.js";
import {
  markGamificationStale,
  scheduleGamificationReconciliation,
} from "../points/gamification-projection.service.js";
import {
  upsertFollower,
  deleteFollower,
  listFollowers,
  listFollowing,
  insertBlock,
  deleteBlock,
} from "./feed.repository.js";
import { findUserByUsername } from "../users/users.repository.js";

export async function followUserByAlias(
  followerId: string,
  alias: string,
): Promise<{ followingId: string }> {
  const targetUser = await findUserByUsername(alias);
  if (!targetUser) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  if (targetUser.id === followerId) {
    throw new HttpError(400, "E.FEED.CANNOT_FOLLOW_SELF", "FEED_CANNOT_FOLLOW_SELF");
  }

  await upsertFollower(followerId, targetUser.id);
  try {
    await evaluateBadgesForFollow(followerId);
  } catch (error) {
    // The follow is authoritative; badges are a derived projection and must not roll it back.
    logger.error(
      { err: error, userId: followerId },
      "[feed] Follow badge evaluation failed; scheduling gamification reconciliation",
    );
    try {
      await markGamificationStale(followerId, true);
      scheduleGamificationReconciliation(followerId, undefined, true);
    } catch (reconciliationError) {
      logger.error(
        { err: reconciliationError, userId: followerId },
        "[feed] Failed to schedule gamification reconciliation after badge evaluation failure",
      );
    }
  }

  return { followingId: targetUser.id };
}

export async function unfollowUserByAlias(
  followerId: string,
  alias: string,
): Promise<{ unfollowedId: string }> {
  const targetUser = await findUserByUsername(alias);
  if (!targetUser) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  if (targetUser.id === followerId) {
    return { unfollowedId: targetUser.id };
  }

  await deleteFollower(followerId, targetUser.id);

  return { unfollowedId: targetUser.id };
}

export async function listUserFollowers(alias: string): Promise<
  Array<{
    id: string;
    username: string;
    displayName: string;
    followedAt: string;
  }>
> {
  const targetUser = await findUserByUsername(alias);
  if (!targetUser) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  const rows = await listFollowers(targetUser.id);
  return rows.map((row) => ({
    id: row.follower_id,
    username: row.follower_username,
    displayName: row.follower_display_name,
    followedAt: row.followed_at,
  }));
}

export async function listUserFollowing(alias: string): Promise<
  Array<{
    id: string;
    username: string;
    displayName: string;
    followedAt: string;
  }>
> {
  const targetUser = await findUserByUsername(alias);
  if (!targetUser) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  const rows = await listFollowing(targetUser.id);
  return rows.map((row) => ({
    id: row.following_id,
    username: row.following_username,
    displayName: row.following_display_name,
    followedAt: row.followed_at,
  }));
}

export async function blockUserByAlias(
  blockerId: string,
  alias: string,
): Promise<{ blockedId: string }> {
  const target = await findUserByUsername(alias);
  if (!target) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  if (target.id === blockerId) {
    throw new HttpError(400, "E.FEED.CANNOT_BLOCK_SELF", "FEED_CANNOT_BLOCK_SELF");
  }

  await insertBlock(blockerId, target.id);

  await insertAudit({
    actorUserId: blockerId,
    entityType: "users",
    action: "feed.block",
    entityId: target.id,
  });

  return { blockedId: target.id };
}

export async function unblockUserByAlias(
  blockerId: string,
  alias: string,
): Promise<{ unblockedId: string }> {
  const target = await findUserByUsername(alias);
  if (!target) {
    throw new HttpError(404, "E.FEED.USER_NOT_FOUND", "FEED_USER_NOT_FOUND");
  }
  if (target.id === blockerId) {
    return { unblockedId: target.id };
  }

  await deleteBlock(blockerId, target.id);

  await insertAudit({
    actorUserId: blockerId,
    entityType: "users",
    action: "feed.unblock",
    entityId: target.id,
  });

  return { unblockedId: target.id };
}
