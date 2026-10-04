import { db } from "../../../../apps/backend/src/db/connection.js";
import * as feedRepository from "../../../../apps/backend/src/modules/feed/feed.repository.js";
import type { FeedQueryOptions } from "../../../../apps/backend/src/modules/feed/feed.repository.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = []) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereNotExists: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    whereRaw: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnValue({}),
  });
  // Add db.raw to the builder
  (builder as any).raw = jest.fn().mockReturnValue({});
  return builder;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  }) as jest.Mock & {
    raw: jest.Mock;
    fn: { now: jest.Mock };
  };

  // Add db.raw for COUNT(*) queries
  mockDbFunction.raw = jest.fn().mockReturnValue("COUNT(*)");
  // Add db.fn.now() for timestamp functions
  mockDbFunction.fn = {
    now: jest.fn().mockReturnValue(new Date().toISOString()),
  };

  return {
    db: mockDbFunction,
  };
});

describe("Feed Repository", () => {
  const userId = "user-123";
  const feedItemId = "feed-item-123";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("listFeedSessions", () => {
    it("should list public feed sessions", async () => {
      const options: FeedQueryOptions = { scope: "public" };
      const mockRows: feedRepository.FeedItemWithSessionRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        // Create a new builder with the mock data as default
        const newBuilder = createMockQueryBuilder(mockRows);
        // Replace the builder in queryBuilders
        queryBuilders["feed_items"] = newBuilder;
      }

      const result = await feedRepository.listFeedSessions(options);

      expect(result).toEqual(mockRows);
      expect(queryBuilders["feed_items"]?.where).toHaveBeenCalledWith(
        "sessions.visibility",
        "public",
      );
    });

    it("should list user's own feed sessions", async () => {
      const options: FeedQueryOptions = { scope: "me", viewerId: userId };
      const mockRows: feedRepository.FeedItemWithSessionRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        const newBuilder = createMockQueryBuilder(mockRows);
        queryBuilders["feed_items"] = newBuilder;
      }

      const result = await feedRepository.listFeedSessions(options);

      expect(result).toEqual(mockRows);
      expect(queryBuilders["feed_items"]?.where).toHaveBeenCalledWith(
        "feed_items.owner_id",
        userId,
      );
    });

    it("should apply search query when provided", async () => {
      const options: FeedQueryOptions = {
        scope: "public",
        searchQuery: "test query",
      };
      const mockRows: feedRepository.FeedItemWithSessionRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        const newBuilder = createMockQueryBuilder(mockRows);
        queryBuilders["feed_items"] = newBuilder;
      }

      const result = await feedRepository.listFeedSessions(options);

      expect(result).toEqual(mockRows);
      expect(queryBuilders["feed_items"]?.leftJoin).toHaveBeenCalledWith(
        "session_exercises",
        "session_exercises.session_id",
        "sessions.id",
      );
    });

    it("should apply popularity sorting when sort is popularity", async () => {
      const options: FeedQueryOptions = {
        scope: "public",
        sort: "popularity",
      };
      const mockRows: feedRepository.FeedItemWithSessionRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        const newBuilder = createMockQueryBuilder(mockRows);
        queryBuilders["feed_items"] = newBuilder;
      }

      const result = await feedRepository.listFeedSessions(options);

      expect(result).toEqual(mockRows);
      expect(queryBuilders["feed_items"]?.leftJoin).toHaveBeenCalledWith(
        "feed_likes",
        "feed_likes.feed_item_id",
        "feed_items.id",
      );
      expect(queryBuilders["feed_items"]?.groupBy).toHaveBeenCalled();
    });

    it("should apply relevance sorting when sort is relevance", async () => {
      const options: FeedQueryOptions = {
        scope: "public",
        sort: "relevance",
      };
      const mockRows: feedRepository.FeedItemWithSessionRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        const newBuilder = createMockQueryBuilder(mockRows);
        queryBuilders["feed_items"] = newBuilder;
      }

      const result = await feedRepository.listFeedSessions(options);

      expect(result).toEqual(mockRows);
      expect(queryBuilders["feed_items"]?.orderBy).toHaveBeenCalledWith(
        "feed_items.published_at",
        "desc",
      );
    });
  });

  describe("findFeedItemById", () => {
    it("should find feed item by id", async () => {
      const mockFeedItem: feedRepository.FeedItemRow = {
        id: feedItemId,
        owner_id: userId,
        session_id: "session-123",
        visibility: "public",
        published_at: new Date().toISOString(),
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_items");
      if (queryBuilders["feed_items"]) {
        queryBuilders["feed_items"].first.mockResolvedValue(mockFeedItem);
      }

      const result = await feedRepository.findFeedItemById(feedItemId);

      expect(result).toEqual(mockFeedItem);
      expect(queryBuilders["feed_items"]?.where).toHaveBeenCalledWith({ id: feedItemId });
    });
  });

  describe("getFeedItemStats", () => {
    it("should get feed item stats", async () => {
      const feedItemIds = [feedItemId];
      const mockLikes = [{ feed_item_id: feedItemId, count: "5" }];
      const mockComments = [{ feed_item_id: feedItemId, count: "2" }];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_likes");
      dbFn("feed_comments");
      if (queryBuilders["feed_likes"]) {
        queryBuilders["feed_likes"].whereIn.mockReturnThis();
        queryBuilders["feed_likes"].groupBy.mockReturnThis();
        queryBuilders["feed_likes"].select.mockResolvedValue(mockLikes);
      }
      if (queryBuilders["feed_comments"]) {
        queryBuilders["feed_comments"].whereIn.mockReturnThis();
        queryBuilders["feed_comments"].whereNull.mockReturnThis();
        queryBuilders["feed_comments"].groupBy.mockReturnThis();
        queryBuilders["feed_comments"].select.mockResolvedValue(mockComments);
      }

      const result = await feedRepository.getFeedItemStats(feedItemIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.has(feedItemId)).toBe(true);
      const stats = result.get(feedItemId);
      expect(stats).toBeDefined();
      expect(stats?.likes).toBe(5);
      expect(stats?.comments).toBe(2);
    });

    it("should return empty map for empty array", async () => {
      const result = await feedRepository.getFeedItemStats([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("should handle number count", async () => {
      const feedItemIds = [feedItemId];
      const mockLikes = [{ feed_item_id: feedItemId, count: 10 }];
      const mockComments = [{ feed_item_id: feedItemId, count: 3 }];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("feed_likes");
      dbFn("feed_comments");
      if (queryBuilders["feed_likes"]) {
        queryBuilders["feed_likes"].whereIn.mockReturnThis();
        queryBuilders["feed_likes"].groupBy.mockReturnThis();
        queryBuilders["feed_likes"].select.mockResolvedValue(mockLikes);
      }
      if (queryBuilders["feed_comments"]) {
        queryBuilders["feed_comments"].whereIn.mockReturnThis();
        queryBuilders["feed_comments"].whereNull.mockReturnThis();
        queryBuilders["feed_comments"].groupBy.mockReturnThis();
        queryBuilders["feed_comments"].select.mockResolvedValue(mockComments);
      }

      const result = await feedRepository.getFeedItemStats(feedItemIds);

      expect(result.get(feedItemId)?.likes).toBe(10);
      expect(result.get(feedItemId)?.comments).toBe(3);
    });
  });

  describe("findSessionById", () => {
    it("should find session by id", async () => {
      const sessionId = "session-123";
      const mockSession = {
        id: sessionId,
        owner_id: userId,
        visibility: "public",
        status: "completed",
        completed_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);

      const result = await feedRepository.findSessionById(sessionId);

      expect(result).toEqual(mockSession);
      expect(newBuilder.where).toHaveBeenCalledWith({ id: sessionId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
    });

    it("should return undefined when session not found", async () => {
      const sessionId = "session-123";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(undefined);

      const result = await feedRepository.findSessionById(sessionId);

      expect(result).toBeUndefined();
    });
  });

  describe("findFeedItemBySessionId", () => {
    it("should find feed item by session id", async () => {
      const sessionId = "session-123";
      const mockFeedItem: feedRepository.FeedItemRow = {
        id: feedItemId,
        owner_id: userId,
        session_id: sessionId,
        visibility: "public",
        published_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockFeedItem);

      const result = await feedRepository.findFeedItemBySessionId(sessionId);

      expect(result).toEqual(mockFeedItem);
      expect(newBuilder.where).toHaveBeenCalledWith({ session_id: sessionId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
    });

    it("should return undefined when feed item not found", async () => {
      const sessionId = "session-123";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.first.mockResolvedValue(undefined);

      const result = await feedRepository.findFeedItemBySessionId(sessionId);

      expect(result).toBeUndefined();
    });
  });

  describe("insertFeedItem", () => {
    it("should insert feed item with session", async () => {
      const sessionId = "session-123";
      const mockFeedItem: feedRepository.FeedItemRow = {
        id: feedItemId,
        owner_id: userId,
        session_id: sessionId,
        visibility: "public",
        published_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockFeedItem]);

      const result = await feedRepository.insertFeedItem({
        ownerId: userId,
        sessionId,
        visibility: "public",
      });

      expect(result).toEqual(mockFeedItem);
      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          session_id: sessionId,
          visibility: "public",
        }),
      );
    });

    it("should insert feed item without session", async () => {
      const mockFeedItem: feedRepository.FeedItemRow = {
        id: feedItemId,
        owner_id: userId,
        session_id: null,
        visibility: "public",
        published_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockFeedItem]);

      const result = await feedRepository.insertFeedItem({
        ownerId: userId,
        visibility: "public",
      });

      expect(result).toEqual(mockFeedItem);
      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          session_id: null,
          visibility: "public",
        }),
      );
    });

    it("should insert feed item with published_at", async () => {
      const publishedAt = new Date("2024-01-15");
      const mockFeedItem: feedRepository.FeedItemRow = {
        id: feedItemId,
        owner_id: userId,
        session_id: null,
        visibility: "public",
        published_at: publishedAt.toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockFeedItem]);

      await feedRepository.insertFeedItem({
        ownerId: userId,
        visibility: "public",
        publishedAt,
      });

      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          published_at: publishedAt,
        }),
      );
    });
  });

  describe("insertSessionFeedItemAtomic", () => {
    it("should reactivate a soft-deleted item after an atomic insert conflict", async () => {
      const sessionId = "session-soft-deleted";
      const restored: feedRepository.FeedItemRow = {
        id: "feed-restored",
        owner_id: userId,
        session_id: sessionId,
        visibility: "followers",
        published_at: new Date().toISOString(),
      };

      const builder = createMockQueryBuilder();
      queryBuilders["feed_items"] = builder;
      builder.returning.mockResolvedValueOnce([]).mockResolvedValueOnce([restored]);
      builder.first.mockResolvedValueOnce(undefined);
      builder.update.mockReturnThis();

      const result = await feedRepository.insertSessionFeedItemAtomic({
        ownerId: userId,
        sessionId,
        visibility: "followers",
      });

      expect(result).toEqual({ row: restored, created: true });
      expect(builder.whereNotNull).toHaveBeenCalledWith("deleted_at");
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          visibility: "followers",
          deleted_at: null,
        }),
      );
    });
  });

  describe("insertSessionFeedItemAtomic visibility reconciliation", () => {
    it("updates an existing active item when authoritative session visibility changes", async () => {
      const sessionId = "session-existing";
      const existing: feedRepository.FeedItemRow = {
        id: "feed-existing",
        owner_id: userId,
        session_id: sessionId,
        visibility: "public",
        published_at: new Date().toISOString(),
      };
      const updated = { ...existing, visibility: "followers" };

      const builder = createMockQueryBuilder();
      queryBuilders["feed_items"] = builder;
      builder.returning.mockResolvedValueOnce([]).mockResolvedValueOnce([updated]);
      builder.first.mockResolvedValueOnce(existing);
      builder.update.mockReturnThis();

      const result = await feedRepository.insertSessionFeedItemAtomic({
        ownerId: userId,
        sessionId,
        visibility: "followers",
      });

      expect(result).toEqual({ row: updated, created: false });
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          visibility: "followers",
          updated_at: expect.any(String),
        }),
      );
    });
  });

  describe("updateFeedItem", () => {
    it("should update feed item", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await feedRepository.updateFeedItem(feedItemId, {
        visibility: "private",
      });

      expect(newBuilder.where).toHaveBeenCalledWith({ id: feedItemId });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: "private",
          updated_at: expect.any(String),
        }),
      );
    });

    it("should not update when patch is empty", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_items"] = newBuilder;

      await feedRepository.updateFeedItem(feedItemId, {});

      expect(newBuilder.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteFollower", () => {
    it("should delete follower", async () => {
      const followingId = "user-456";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["followers"] = newBuilder;
      newBuilder.del.mockResolvedValue(1);

      const result = await feedRepository.deleteFollower(userId, followingId);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({
        follower_id: userId,
        following_id: followingId,
      });
      expect(newBuilder.del).toHaveBeenCalled();
    });
  });

  describe("upsertFollower", () => {
    it("should insert new follower", async () => {
      const followingId = "user-456";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["followers"] = newBuilder;
      newBuilder.ignore.mockResolvedValue([{ id: "follower-1" }]);

      const result = await feedRepository.upsertFollower(userId, followingId);

      expect(result).toBe(true);
      expect(newBuilder.insert).toHaveBeenCalledWith({
        follower_id: userId,
        following_id: followingId,
      });
      expect(newBuilder.onConflict).toHaveBeenCalledWith(["follower_id", "following_id"]);
    });

    it("should return false when insert is ignored (conflict)", async () => {
      const followingId = "user-456";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["followers"] = newBuilder;
      newBuilder.ignore.mockResolvedValue([]);

      const result = await feedRepository.upsertFollower(userId, followingId);

      expect(result).toBe(false);
    });

    it("should handle number result", async () => {
      const followingId = "user-456";
      const newBuilder = createMockQueryBuilder();
      queryBuilders["followers"] = newBuilder;
      newBuilder.ignore.mockResolvedValue(1);

      const result = await feedRepository.upsertFollower(userId, followingId);

      expect(result).toBe(true);
    });
  });

  describe("listFollowers", () => {
    it("should list followers", async () => {
      const mockFollowers = [
        {
          follower_id: "user-456",
          follower_username: "follower1",
          follower_display_name: "Follower One",
          followed_at: new Date().toISOString(),
        },
      ];

      const newBuilder = createMockQueryBuilder(mockFollowers);
      queryBuilders["followers"] = newBuilder;

      const result = await feedRepository.listFollowers(userId);

      expect(result).toEqual(mockFollowers);
      expect(newBuilder.join).toHaveBeenCalled();
      expect(newBuilder.where).toHaveBeenCalled();
      expect(newBuilder.orderBy).toHaveBeenCalled();
    });
  });

  describe("listFollowing", () => {
    it("should list following", async () => {
      const mockFollowing = [
        {
          following_id: "user-456",
          following_username: "following1",
          following_display_name: "Following One",
          followed_at: new Date().toISOString(),
        },
      ];

      const newBuilder = createMockQueryBuilder(mockFollowing);
      queryBuilders["followers"] = newBuilder;

      const result = await feedRepository.listFollowing(userId);

      expect(result).toEqual(mockFollowing);
      expect(newBuilder.join).toHaveBeenCalled();
      expect(newBuilder.where).toHaveBeenCalled();
      expect(newBuilder.orderBy).toHaveBeenCalled();
    });
  });

  describe("upsertFeedLike", () => {
    it("should insert new like", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_likes"] = newBuilder;
      newBuilder.ignore.mockResolvedValue([{ id: "like-1" }]);

      const result = await feedRepository.upsertFeedLike(feedItemId, userId);

      expect(result).toBe(true);
      expect(newBuilder.insert).toHaveBeenCalledWith({
        feed_item_id: feedItemId,
        user_id: userId,
      });
      expect(newBuilder.onConflict).toHaveBeenCalledWith(["feed_item_id", "user_id"]);
    });

    it("should return false when like already exists", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_likes"] = newBuilder;
      newBuilder.ignore.mockResolvedValue([]);

      const result = await feedRepository.upsertFeedLike(feedItemId, userId);

      expect(result).toBe(false);
    });
  });

  describe("deleteFeedLike", () => {
    it("should delete feed like", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["feed_likes"] = newBuilder;
      newBuilder.del.mockResolvedValue(1);

      const result = await feedRepository.deleteFeedLike(feedItemId, userId);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({
        feed_item_id: feedItemId,
        user_id: userId,
      });
      expect(newBuilder.del).toHaveBeenCalled();
    });
  });

  describe("findUserLikedFeedItems", () => {
    it("should find user liked feed items", async () => {
      const feedItemIds = [feedItemId, "feed-item-456"];
      const mockLikes = [{ feed_item_id: feedItemId }];

      const newBuilder = createMockQueryBuilder(mockLikes);
      queryBuilders["feed_likes"] = newBuilder;

      const result = await feedRepository.findUserLikedFeedItems(userId, feedItemIds);

      expect(result).toBeInstanceOf(Set);
      expect(result.has(feedItemId)).toBe(true);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.whereIn).toHaveBeenCalledWith("feed_item_id", feedItemIds);
    });

    it("should return empty set for empty array", async () => {
      const result = await feedRepository.findUserLikedFeedItems(userId, []);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should return empty set when userId is empty", async () => {
      const result = await feedRepository.findUserLikedFeedItems("", [feedItemId]);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
