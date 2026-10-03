import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedSessionCard } from "../../src/components/feed/FeedSessionCard";
import type { FeedItem } from "../../src/services/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/components/feed/LikeButton", () => ({
  LikeButton: () => <div>like</div>,
}));
vi.mock("../../src/components/feed/BookmarkButton", () => ({
  BookmarkButton: () => <div>bookmark</div>,
}));
vi.mock("../../src/components/feed/ShareButton", () => ({
  ShareButton: () => <div>share</div>,
}));
vi.mock("../../src/components/feed/CloneSessionButton", () => ({
  CloneSessionButton: () => <div>clone</div>,
}));

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "item-1",
    feedItemId: "feed-1",
    user: { id: "user-1", username: "alex", displayName: "Alex" },
    session: {
      id: "session-1",
      title: "Push day",
      notes: "Keep rest short",
      plannedAt: "2026-01-02T18:00:00.000Z",
      exerciseCount: 3,
    },
    visibility: "public",
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    likesCount: 2,
    commentsCount: 4,
    ...overrides,
  };
}

describe("FeedSessionCard", () => {
  it("renders session details and routes clicks", () => {
    const onUserClick = vi.fn();
    const onSessionClick = vi.fn();
    render(
      <FeedSessionCard
        item={makeItem()}
        onUserClick={onUserClick}
        onSessionClick={onSessionClick}
      />,
    );

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Push day")).toBeInTheDocument();
    expect(screen.getByText("Keep rest short")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/feed.exercises/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alex"));
    expect(onUserClick).toHaveBeenCalledWith("user-1");
    fireEvent.click(screen.getByText("Push day"));
    expect(onSessionClick).toHaveBeenCalledWith("session-1");
  });

  it("formats timestamps and falls back to username", () => {
    const now = Date.now();
    const { rerender } = render(
      <FeedSessionCard
        item={makeItem({
          user: { id: "u", username: "solo" },
          session: { id: "s", exerciseCount: 1, plannedAt: "" },
          commentsCount: 0,
          publishedAt: null,
          createdAt: new Date(now - 10_000).toISOString(),
        })}
      />,
    );
    expect(screen.getByText("solo")).toBeInTheDocument();
    expect(screen.getByText(/feed.timestamp.momentsAgo/)).toBeInTheDocument();
    expect(screen.getByText(/feed.exercise$/)).toBeInTheDocument();

    rerender(
      <FeedSessionCard
        item={makeItem({
          publishedAt: new Date(now - 5 * 60_000).toISOString(),
          commentsCount: 0,
        })}
      />,
    );
    expect(screen.getByText(/feed.timestamp.minutesAgo/)).toBeInTheDocument();

    rerender(
      <FeedSessionCard
        item={makeItem({
          publishedAt: new Date(now - 2 * 3_600_000).toISOString(),
          commentsCount: 0,
        })}
      />,
    );
    expect(screen.getByText(/feed.timestamp.hoursAgo/)).toBeInTheDocument();

    rerender(
      <FeedSessionCard
        item={makeItem({
          publishedAt: new Date(now - 3 * 86_400_000).toISOString(),
          commentsCount: 0,
        })}
      />,
    );
    expect(screen.getByText(/feed.timestamp.daysAgo/)).toBeInTheDocument();

    rerender(
      <FeedSessionCard
        item={makeItem({
          publishedAt: "2020-06-01T00:00:00.000Z",
          commentsCount: 0,
        })}
      />,
    );
    expect(screen.getByText(/Jun/)).toBeInTheDocument();
  });
});
