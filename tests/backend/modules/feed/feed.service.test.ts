import * as feedService from "../../../../apps/backend/src/modules/feed/feed.service.js";
import * as feedRepository from "../../../../apps/backend/src/modules/feed/feed.repository.js";
import * as sessionsCloneService from "../../../../apps/backend/src/modules/sessions/sessions.clone.service.js";
import * as usersRepository from "../../../../apps/backend/src/modules/users/users.repository.js";
import * as badgesService from "../../../../apps/backend/src/modules/points/badges.service.js";
import * as projectionService from "../../../../apps/backend/src/modules/points/gamification-projection.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/feed/feed.repository.js");
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.clone.service.js");
jest.mock("../../../../apps/backend/src/modules/users/users.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/modules/points/badges.service.js", () => ({
  evaluateBadgesForFollow: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../../../apps/backend/src/modules/points/gamification-projection.service.js", () => ({
  markGamificationStale: jest.fn().mockResolvedValue(undefined),
  scheduleGamificationReconciliation: jest.fn(),
}));

const mockFeedRepo = jest.mocked(feedRepository);
const mockSessionsCloneService = jest.mocked(sessionsCloneService);
const mockUsersRepo = jest.mocked(usersRepository);
const mockBadgesService = jest.mocked(badgesService);
const mockProjectionService = jest.mocked(projectionService);

describe("Feed Service", () => {
  const userId = "user-123";
  const feedItemId = "feed-item-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getFeed", () => {
    it("should return public feed", async () => {
      const mockRows = [
        {
          feed_item_id: feedItemId,
          owner_id: userId,
          owner_username: "testuser",
          owner_display_name: "Test User",
          visibility: "public",
          published_at: new Date().toISOString(),
          session_id: sessionId,
          session_title: "Test Session",
          session_completed_at: new Date().toISOString(),
          session_points: 50,
        },
      ];

      mockFeedRepo.listFeedSessions.mockResolvedValue(mockRows);
      const statsMap = new Map();
      statsMap.set(feedItemId, {
        likes: 5,
        comments: 2,
      });
      mockFeedRepo.getFeedItemStats.mockResolvedValue(statsMap);
      mockFeedRepo.findUserLikedFeedItems.mockResolvedValue(new Set());
      mockFeedRepo.findUserBookmarkedSessions.mockResolvedValue(new Set());

      const result = await feedService.getFeed({ scope: "public" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].feedItemId).toBe(feedItemId);
    });

    it("should throw error when authenticated scope requested without viewerId", async () => {
      await expect(feedService.getFeed({ scope: "me" })).rejects.toThrow(HttpError);
      await expect(feedService.getFeed({ scope: "me" })).rejects.toThrow("FEED_AUTH_REQUIRED");
    });

    it("should return feed for authenticated user", async () => {
      mockFeedRepo.listFeedSessions.mockResolvedValue([]);
      mockFeedRepo.getFeedItemStats.mockResolvedValue(new Map());
      mockFeedRepo.findUserLikedFeedItems.mockResolvedValue(new Set());
      mockFeedRepo.findUserBookmarkedSessions.mockResolvedValue(new Set());

      const result = await feedService.getFeed({ viewerId: userId, scope: "me" });

      expect(result.items).toEqual([]);
      expect(mockFeedRepo.listFeedSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerId: userId,
          scope: "me",
          limit: 20,
          offset: 0,
        }),
      );
    });
  });

  describe("cloneSessionFromFeed", () => {
    it("should clone session from feed", async () => {
      const mockSession = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "public",
        exercises: [],
      };

      mockSessionsCloneService.cloneOne.mockResolvedValue(mockSession as never);

      const result = await feedService.cloneSessionFromFeed(userId, sessionId);

      expect(result).toEqual(mockSession);
      expect(mockSessionsCloneService.cloneOne).toHaveBeenCalled();
    });

    it("should throw 404 when session not found", async () => {
      mockSessionsCloneService.cloneOne.mockRejectedValue(
        new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND"),
      );

      await expect(feedService.cloneSessionFromFeed(userId, sessionId)).rejects.toThrow(HttpError);
    });
  });

  describe("followUserByAlias", () => {
    it("should follow user by alias", async () => {
      const targetUser = {
        id: "target-user",
        username: "targetuser",
      };

      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.upsertFollower.mockResolvedValue(undefined);

      await feedService.followUserByAlias(userId, "targetuser");

      expect(mockFeedRepo.upsertFollower).toHaveBeenCalledWith(userId, targetUser.id);
    });

    it("should keep the follow and schedule existing reconciliation when badge evaluation fails", async () => {
      const targetUser = { id: "target-user", username: "targetuser" };
      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.upsertFollower.mockResolvedValue(undefined);
      mockBadgesService.evaluateBadgesForFollow.mockRejectedValueOnce(new Error("badge failure"));

      await expect(feedService.followUserByAlias(userId, "targetuser")).resolves.toEqual({
        followingId: targetUser.id,
      });

      expect(mockProjectionService.markGamificationStale).toHaveBeenCalledWith(userId, true);
      expect(mockProjectionService.scheduleGamificationReconciliation).toHaveBeenCalledWith(
        userId,
        undefined,
        true,
      );
    });

    it("should throw 404 when user not found", async () => {
      mockUsersRepo.findUserByUsername.mockResolvedValue(null);

      await expect(feedService.followUserByAlias(userId, "nonexistent")).rejects.toThrow(HttpError);
    });
  });

  describe("unfollowUserByAlias", () => {
    it("should unfollow user by alias", async () => {
      const targetUser = {
        id: "target-user",
        username: "targetuser",
      };

      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.deleteFollower.mockResolvedValue(1);

      await feedService.unfollowUserByAlias(userId, "targetuser");

      expect(mockFeedRepo.deleteFollower).toHaveBeenCalledWith(userId, targetUser.id);
    });
  });

  describe("likeFeedItem", () => {
    it("should like a feed item", async () => {
      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: userId,
      });
      mockFeedRepo.findSessionById.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "public",
      });
      mockFeedRepo.upsertFeedLike.mockResolvedValue(undefined);
      const statsMap = new Map();
      statsMap.set(feedItemId, { likes: 1, comments: 0 });
      mockFeedRepo.getFeedItemStats.mockResolvedValue(statsMap);

      await feedService.likeFeedItem(userId, feedItemId);

      expect(mockFeedRepo.upsertFeedLike).toHaveBeenCalledWith(feedItemId, userId);
    });

    it("should throw 404 when feed item not found", async () => {
      mockFeedRepo.findFeedItemById.mockResolvedValue(null);

      await expect(feedService.likeFeedItem(userId, feedItemId)).rejects.toThrow(HttpError);
    });
  });

  describe("unlikeFeedItem", () => {
    it("should unlike a feed item", async () => {
      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: userId,
      });
      mockFeedRepo.findSessionById.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "public",
      });
      mockFeedRepo.deleteFeedLike.mockResolvedValue(1);
      const statsMap = new Map();
      statsMap.set(feedItemId, { likes: 0, comments: 0 });
      mockFeedRepo.getFeedItemStats.mockResolvedValue(statsMap);

      await feedService.unlikeFeedItem(userId, feedItemId);

      expect(mockFeedRepo.deleteFeedLike).toHaveBeenCalledWith(feedItemId, userId);
    });
  });

  describe("bookmarkSession", () => {
    it("should bookmark a session", async () => {
      mockFeedRepo.findSessionById.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "public",
      });
      mockFeedRepo.upsertBookmark.mockResolvedValue(undefined);

      await feedService.bookmarkSession(userId, sessionId);

      expect(mockFeedRepo.upsertBookmark).toHaveBeenCalledWith(sessionId, userId);
    });
  });

  describe("removeBookmark", () => {
    it("should remove bookmark", async () => {
      mockFeedRepo.findSessionById.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "public",
      });
      mockFeedRepo.deleteBookmark.mockResolvedValue(1);

      await feedService.removeBookmark(userId, sessionId);

      expect(mockFeedRepo.deleteBookmark).toHaveBeenCalledWith(sessionId, userId);
    });
  });

  describe("listBookmarks", () => {
    it("should list bookmarked sessions", async () => {
      const mockBookmarks = [
        {
          session_id: sessionId,
          feed_item_id: feedItemId,
          title: "Test Session",
          completed_at: new Date().toISOString(),
          visibility: "public",
          owner_id: userId,
          owner_username: "testuser",
          owner_display_name: "Test User",
          points: 50,
          created_at: new Date().toISOString(),
        },
      ];

      mockFeedRepo.listBookmarkedSessions.mockResolvedValue(mockBookmarks);
      const sessionIds = [sessionId];
      const feedItemIds = [feedItemId];
      const statsMap = new Map();
      statsMap.set(feedItemId, { likes: 0, comments: 0 });
      mockFeedRepo.getFeedItemStats.mockResolvedValue(statsMap);
      mockFeedRepo.findUserLikedFeedItems.mockResolvedValue(new Set());

      const result = await feedService.listBookmarks(userId, {});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockFeedRepo.listBookmarkedSessions).toHaveBeenCalledWith(
        userId,
        undefined,
        undefined,
      );
    });
  });

  describe("createComment", () => {
    it("should create a comment", async () => {
      const commentText = "Great workout!";

      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: userId,
      });
      mockFeedRepo.insertComment.mockResolvedValue({
        id: "comment-123",
        feed_item_id: feedItemId,
        author_id: userId,
        content: commentText,
        created_at: new Date().toISOString(),
      });
      mockFeedRepo.getCommentWithAuthor.mockResolvedValue({
        id: "comment-123",
        feed_item_id: feedItemId,
        user_id: userId,
        username: "testuser",
        display_name: "Test User",
        body: commentText,
        created_at: new Date().toISOString(),
        edited_at: null,
      });
      const statsMap = new Map();
      statsMap.set(feedItemId, { likes: 0, comments: 1 });
      mockFeedRepo.getFeedItemStats.mockResolvedValue(statsMap);

      const result = await feedService.createComment(userId, feedItemId, commentText);

      expect(result.body).toBe(commentText);
      expect(mockFeedRepo.insertComment).toHaveBeenCalled();
    });

    it("should throw 404 when feed item not found", async () => {
      mockFeedRepo.findFeedItemById.mockResolvedValue(null);

      await expect(feedService.createComment(userId, feedItemId, "test")).rejects.toThrow(
        HttpError,
      );
    });
  });

  describe("deleteComment", () => {
    it("should delete a comment", async () => {
      const commentId = "comment-123";

      mockFeedRepo.findCommentById.mockResolvedValue({
        id: commentId,
        feed_item_id: feedItemId,
        user_id: userId,
        content: "test",
        created_at: new Date().toISOString(),
        deleted_at: null,
      });
      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: userId,
      });
      mockFeedRepo.softDeleteComment.mockResolvedValue(1);

      await feedService.deleteComment(userId, commentId);

      expect(mockFeedRepo.softDeleteComment).toHaveBeenCalledWith(commentId);
    });

    it("should return deleted false when comment not found", async () => {
      mockFeedRepo.findCommentById.mockResolvedValue(null);

      const result = await feedService.deleteComment(userId, "comment-123");

      expect(result.deleted).toBe(false);
    });

    it("should throw 403 when user is not comment author", async () => {
      mockFeedRepo.findCommentById.mockResolvedValue({
        id: "comment-123",
        feed_item_id: feedItemId,
        user_id: "other-user",
        content: "test",
        created_at: new Date().toISOString(),
        deleted_at: null,
      });
      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: "other-user", // Different owner
      });

      await expect(feedService.deleteComment(userId, "comment-123")).rejects.toThrow(HttpError);
    });
  });

  describe("blockUserByAlias", () => {
    it("should block a user", async () => {
      const targetUser = {
        id: "target-user",
        username: "targetuser",
      };

      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.hasBlockRelation.mockResolvedValue(false);
      mockFeedRepo.insertBlock.mockResolvedValue(undefined);

      await feedService.blockUserByAlias(userId, "targetuser");

      expect(mockFeedRepo.insertBlock).toHaveBeenCalledWith(userId, targetUser.id);
    });

    it("should allow blocking already blocked user (idempotent)", async () => {
      const targetUser = {
        id: "target-user",
        username: "targetuser",
      };

      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.insertBlock.mockResolvedValue(undefined);

      const result = await feedService.blockUserByAlias(userId, "targetuser");

      expect(result.blockedId).toBe("target-user");
      expect(mockFeedRepo.insertBlock).toHaveBeenCalledWith(userId, targetUser.id);
    });
  });

  describe("unblockUserByAlias", () => {
    it("should unblock a user", async () => {
      const targetUser = {
        id: "target-user",
        username: "targetuser",
      };

      mockUsersRepo.findUserByUsername.mockResolvedValue(targetUser);
      mockFeedRepo.deleteBlock.mockResolvedValue(1);

      await feedService.unblockUserByAlias(userId, "targetuser");

      expect(mockFeedRepo.deleteBlock).toHaveBeenCalledWith(userId, targetUser.id);
    });
  });

  describe("reportFeedItem", () => {
    it("should report a feed item", async () => {
      mockFeedRepo.findFeedItemById.mockResolvedValue({
        feed_item_id: feedItemId,
        session_id: sessionId,
        owner_id: "other-user", // Different owner to avoid self-reporting issues
        visibility: "public",
      });
      mockFeedRepo.hasBlockRelation.mockResolvedValue(false);
      mockFeedRepo.insertFeedReport.mockResolvedValue(undefined);

      const result = await feedService.reportFeedItem(userId, feedItemId, "spam");

      expect(result.reported).toBe(true);

      expect(mockFeedRepo.insertFeedReport).toHaveBeenCalled();
    });
  });

  describe("getLeaderboard", () => {
    it("should return leaderboard", async () => {
      const mockRows = [
        {
          user_id: userId,
          username: "testuser",
          display_name: "Test User",
          total_points: 1000,
          rank: 1,
        },
      ];

      mockFeedRepo.getLeaderboardRows.mockResolvedValue(mockRows);

      const result = await feedService.getLeaderboard(null, { limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0].user.username).toBe("testuser");
    });
  });
});
