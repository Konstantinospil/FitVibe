import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockHasBlockRelation = jest.fn();
const mockHasBookmark = jest.fn();
const mockIsFollowing = jest.fn();

jest.mock("../../../../apps/backend/src/modules/feed/feed.repository.js", () => ({
  findFeedItemById: jest.fn(),
  findSessionById: jest.fn(),
  getFeedItemStats: jest.fn(),
  hasBlockRelation: mockHasBlockRelation,
  hasBookmark: mockHasBookmark,
  isFollowing: mockIsFollowing,
}));

jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: { feed: { blockedKeywords: [] } },
}));

import { ensureSessionInteractionAllowed } from "../../../../apps/backend/src/modules/feed/feed.access.js";

const session = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  status: "completed",
  visibility: "private",
  completed_at: "2026-09-22T18:00:00.000Z",
};

describe("session key-door access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasBlockRelation.mockResolvedValue(false);
    mockHasBookmark.mockResolvedValue(false);
    mockIsFollowing.mockResolvedValue(false);
  });

  it("allows the owner", async () => {
    await expect(
      ensureSessionInteractionAllowed(session.owner_id, session),
    ).resolves.toBeUndefined();
  });

  it("allows a durable bookmark grant even when the session is private", async () => {
    mockHasBookmark.mockResolvedValue(true);
    await expect(
      ensureSessionInteractionAllowed("33333333-3333-4333-8333-333333333333", session),
    ).resolves.toBeUndefined();
  });

  it("allows public sessions and eligible followers", async () => {
    await expect(
      ensureSessionInteractionAllowed("33333333-3333-4333-8333-333333333333", {
        ...session,
        visibility: "public",
      }),
    ).resolves.toBeUndefined();

    mockIsFollowing.mockResolvedValue(true);
    await expect(
      ensureSessionInteractionAllowed("33333333-3333-4333-8333-333333333333", {
        ...session,
        visibility: "followers",
      }),
    ).resolves.toBeUndefined();
  });

  it("denies a private session without another grant", async () => {
    await expect(
      ensureSessionInteractionAllowed("33333333-3333-4333-8333-333333333333", session),
    ).rejects.toThrow("Session is not visible to this user");
  });

  it("lets blocking override a bookmark grant", async () => {
    mockHasBlockRelation.mockResolvedValue(true);
    mockHasBookmark.mockResolvedValue(true);

    await expect(
      ensureSessionInteractionAllowed("33333333-3333-4333-8333-333333333333", session),
    ).rejects.toThrow("FEED_BLOCKED");
    expect(mockHasBookmark).not.toHaveBeenCalled();
  });
});
