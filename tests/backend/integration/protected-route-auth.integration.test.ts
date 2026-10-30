import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import { env } from "../../../apps/backend/src/config/env.js";
import { usersRouter } from "../../../apps/backend/src/modules/users/users.routes.js";
import { sessionsRouter } from "../../../apps/backend/src/modules/sessions/sessions.routes.js";
import { feedRouter } from "../../../apps/backend/src/modules/feed/feed.routes.js";
import { pointsRouter } from "../../../apps/backend/src/modules/points/points.routes.js";
import * as sessionTokens from "../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import * as authStateRepository from "../../../apps/backend/src/modules/auth/auth.state.repository.js";
import { db } from "../../../apps/backend/src/db/connection.js";

jest.mock("../../../apps/backend/src/modules/auth/auth.session-tokens.js");
jest.mock("../../../apps/backend/src/modules/auth/auth.state.repository.js");
// #557: mock the synthetic account's persisted role, not the MFA guard.
jest.mock("../../../apps/backend/src/db/connection.js", () => ({ db: jest.fn() }));
jest.mock("../../../apps/backend/src/modules/common/rateLimiter.js", () => ({
  rateLimit: jest.fn(() => (_req: Request, _res: Response, next: () => void) => next()),
  rateLimitByUser: jest.fn(() => (_req: Request, _res: Response, next: () => void) => next()),
}));
jest.mock("../../../apps/backend/src/modules/users/users.controller.js", () => ({
  me: jest.fn((req: Request, res: Response) => res.status(200).json({ route: "users", sub: req.user?.sub })),
  list: jest.fn(), getById: jest.fn(), updateMe: jest.fn(), changePassword: jest.fn(),
  deleteAccount: jest.fn(), exportData: jest.fn(), listUserContacts: jest.fn(),
  updateEmail: jest.fn(), updatePhone: jest.fn(), requestContactVerificationHandler: jest.fn(),
  verifyContactHandler: jest.fn(), removeContactHandler: jest.fn(), adminChangeStatus: jest.fn(),
  adminCreateUser: jest.fn(), getMetrics: jest.fn(), getPrivacy: jest.fn(), updatePrivacy: jest.fn(),
  getPreferences: jest.fn(), updatePreferences: jest.fn(),
}));
jest.mock("../../../apps/backend/src/modules/sessions/sessions.controller.js", () => ({
  listSessionsHandler: jest.fn((req: Request, res: Response) => res.status(200).json({ route: "sessions", sub: req.user?.sub })),
  getSessionHandler: jest.fn(), createSessionHandler: jest.fn(), updateSessionHandler: jest.fn(),
  deleteSessionHandler: jest.fn(), reopenSessionHandler: jest.fn(), cloneSessionHandler: jest.fn(),
  applyRecurrenceHandler: jest.fn(),
}));
jest.mock("../../../apps/backend/src/modules/feed/feed.controller.js", () => ({
  getFeedHandler: jest.fn((req: Request, res: Response) => res.status(200).json({ route: "feed", sub: req.user?.sub })),
  getLeaderboardHandler: jest.fn(), cloneSessionFromFeedHandler: jest.fn(), publishSessionHandler: jest.fn(),
  bookmarkSessionHandler: jest.fn(), removeBookmarkHandler: jest.fn(), listBookmarksHandler: jest.fn(),
  likeFeedItemHandler: jest.fn(), unlikeFeedItemHandler: jest.fn(), listCommentsHandler: jest.fn(),
  createCommentHandler: jest.fn(), deleteCommentHandler: jest.fn(), reportFeedItemHandler: jest.fn(),
  reportCommentHandler: jest.fn(), blockUserHandler: jest.fn(), unblockUserHandler: jest.fn(),
  followUserHandler: jest.fn(), unfollowUserHandler: jest.fn(), listFollowersHandler: jest.fn(),
  listFollowingHandler: jest.fn(),
}));
jest.mock("../../../apps/backend/src/modules/points/points.controller.js", () => ({
  getPointsSummaryHandler: jest.fn((req: Request, res: Response) => res.status(200).json({ route: "points", sub: req.user?.sub })),
  getPointsHistoryHandler: jest.fn(), getBadgeCatalogHandler: jest.fn(), getUserBadgesHandler: jest.fn(),
}));

const mockedTokens = jest.mocked(sessionTokens);
const mockedAuthState = jest.mocked(authStateRepository);
const mockedDb = db as unknown as jest.Mock;
const mockRoleLookup = jest.fn();

describe("canonical protected-route authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthState.isSessionActiveForUser.mockResolvedValue(true);
    mockRoleLookup.mockResolvedValue({ role_code: "athlete", status: "active" });
    mockedDb.mockReturnValue({ where: jest.fn().mockReturnValue({ first: mockRoleLookup }) });
  });

  it.each([
    ["/users/me", "users"],
    ["/sessions", "sessions"],
    ["/feed", "feed"],
    ["/points", "points"],
  ])("authenticates %s through the HttpOnly-cookie path without a Bearer header", async (path, route) => {
    mockedTokens.verifyAccess.mockReturnValue({
      sub: "user-cookie",
      role: "athlete",
      sid: "session-cookie",
    } as never);

    const app = express();
    app.use(cookieParser());
    app.use("/users", usersRouter);
    app.use("/sessions", sessionsRouter);
    app.use("/feed", feedRouter);
    app.use("/points", pointsRouter);

    const response = await request(app)
      .get(path)
      .set("Cookie", `${env.ACCESS_COOKIE_NAME}=cookie-access-token`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route, sub: "user-cookie" });
    expect(mockedTokens.verifyAccess).toHaveBeenLastCalledWith("cookie-access-token");
    expect(mockedDb).toHaveBeenCalledWith("users");
    expect(mockRoleLookup).toHaveBeenCalledWith(["role_code", "status"]);
    expect(mockedAuthState.isSessionActiveForUser).toHaveBeenLastCalledWith(
      "session-cookie",
      "user-cookie",
    );
  });
  // #557: test ownership for authenticated HttpOnly-cookie routes and the
  // authorization boundary when an already issued token becomes stale.
  it("blocks a promoted administrator even when the cookie token still says athlete", async () => {
    mockRoleLookup.mockResolvedValue({ role_code: "admin", status: "active" });
    mockedTokens.verifyAccess.mockReturnValue({
      sub: "user-cookie",
      role: "athlete",
      sid: "session-cookie",
    } as never);

    const app = express();
    app.use(cookieParser());
    app.use("/sessions", sessionsRouter);

    const response = await request(app)
      .get("/sessions")
      .set("Cookie", `${env.ACCESS_COOKIE_NAME}=cookie-access-token`);

    expect(response.status).toBe(403);
    expect(mockedDb).toHaveBeenCalledWith("users");
    expect(mockRoleLookup).toHaveBeenCalledWith(["role_code", "status"]);
    expect(mockedAuthState.isSessionActiveForUser).toHaveBeenCalledWith(
      "session-cookie",
      "user-cookie",
    );
  });

});
