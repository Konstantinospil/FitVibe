import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit, rateLimitByUser } from "../common/rateLimiter.js";
import {
  blockUserHandler,
  bookmarkSessionHandler,
  cloneSessionFromFeedHandler,
  createCommentHandler,
  deleteCommentHandler,
  followUserHandler,
  getFeedHandler,
  getLeaderboardHandler,
  likeFeedItemHandler,
  listBookmarksHandler,
  listCommentsHandler,
  listFollowersHandler,
  listFollowingHandler,
  publishSessionHandler,
  removeBookmarkHandler,
  reportCommentHandler,
  reportFeedItemHandler,
  unlikeFeedItemHandler,
  unfollowUserHandler,
  unblockUserHandler,
} from "./feed.controller.js";

export const feedRouter = Router();

// All feed endpoints require authentication per FR-003 (privacy-by-default)
feedRouter.get(
  "/",
  requireAccessToken,
  rateLimitByUser("feed_user"),
  rateLimit("feed_public"),
  asyncHandler(getFeedHandler),
);

feedRouter.get(
  "/leaderboard",
  requireAccessToken,
  rateLimitByUser("feed_leaderboard_user"),
  rateLimit("feed_leaderboard"),
  asyncHandler(getLeaderboardHandler),
);

feedRouter.post(
  "/session/:sessionId/clone",
  requireAccessToken,
  rateLimitByUser("feed_clone_user"),
  rateLimit("feed_clone"),
  asyncHandler(cloneSessionFromFeedHandler),
);

feedRouter.post(
  "/session/:sessionId/publish",
  requireAccessToken,
  rateLimitByUser("feed_publish_user"),
  rateLimit("feed_publish"),
  asyncHandler(publishSessionHandler),
);

feedRouter.post(
  "/session/:sessionId/link",
  requireAccessToken,
  rateLimitByUser("feed_link_user"),
  rateLimit("feed_link"),
  asyncHandler(publishSessionHandler),
);

feedRouter.post(
  "/session/:sessionId/bookmark",
  requireAccessToken,
  rateLimitByUser("feed_bookmark_user"),
  rateLimit("feed_bookmark"),
  asyncHandler(bookmarkSessionHandler),
);

feedRouter.delete(
  "/session/:sessionId/bookmark",
  requireAccessToken,
  rateLimitByUser("feed_bookmark_user"),
  rateLimit("feed_bookmark"),
  asyncHandler(removeBookmarkHandler),
);

feedRouter.get(
  "/bookmarks",
  requireAccessToken,
  rateLimitByUser("feed_bookmark_list_user"),
  rateLimit("feed_bookmark_list"),
  asyncHandler(listBookmarksHandler),
);

feedRouter.post(
  "/item/:feedItemId/like",
  requireAccessToken,
  rateLimitByUser("feed_like_user"),
  rateLimit("feed_like"),
  asyncHandler(likeFeedItemHandler),
);

feedRouter.delete(
  "/item/:feedItemId/like",
  requireAccessToken,
  rateLimitByUser("feed_like_user"),
  rateLimit("feed_like"),
  asyncHandler(unlikeFeedItemHandler),
);

feedRouter.get(
  "/item/:feedItemId/comments",
  requireAccessToken,
  rateLimitByUser("feed_comments_list_user"),
  rateLimit("feed_comments_list"),
  asyncHandler(listCommentsHandler),
);

feedRouter.post(
  "/item/:feedItemId/comments",
  requireAccessToken,
  rateLimitByUser("feed_comments_create_user"),
  rateLimit("feed_comments_create"),
  asyncHandler(createCommentHandler),
);

feedRouter.delete(
  "/comments/:commentId",
  requireAccessToken,
  rateLimitByUser("feed_comments_delete_user"),
  rateLimit("feed_comments_delete"),
  asyncHandler(deleteCommentHandler),
);

feedRouter.post(
  "/item/:feedItemId/report",
  requireAccessToken,
  rateLimitByUser("feed_report_item_user"),
  rateLimit("feed_report_item"),
  asyncHandler(reportFeedItemHandler),
);

feedRouter.post(
  "/comments/:commentId/report",
  requireAccessToken,
  rateLimitByUser("feed_report_comment_user"),
  rateLimit("feed_report_comment"),
  asyncHandler(reportCommentHandler),
);

feedRouter.post(
  "/users/:alias/block",
  requireAccessToken,
  rateLimitByUser("feed_block_user"),
  rateLimit("feed_block_user"),
  asyncHandler(blockUserHandler),
);

feedRouter.delete(
  "/users/:alias/block",
  requireAccessToken,
  rateLimitByUser("feed_block_user"),
  rateLimit("feed_block_user"),
  asyncHandler(unblockUserHandler),
);

feedRouter.post(
  "/users/:alias/follow",
  requireAccessToken,
  rateLimitByUser("feed_follow_user"),
  rateLimit("feed_follow_user"),
  asyncHandler(followUserHandler),
);

feedRouter.delete(
  "/users/:alias/follow",
  requireAccessToken,
  rateLimitByUser("feed_follow_user"),
  rateLimit("feed_follow_user"),
  asyncHandler(unfollowUserHandler),
);

feedRouter.get(
  "/users/:alias/followers",
  requireAccessToken,
  rateLimitByUser("feed_followers_list_user"),
  rateLimit("feed_followers_list"),
  asyncHandler(listFollowersHandler),
);

feedRouter.get(
  "/users/:alias/following",
  requireAccessToken,
  rateLimitByUser("feed_following_list_user"),
  rateLimit("feed_following_list"),
  asyncHandler(listFollowingHandler),
);
