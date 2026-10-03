import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedView } from "../../src/components/feed/FeedView";

const getFeed = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  getFeed: (...args: unknown[]) => getFeed(...args),
}));

vi.mock("../../src/components/feed/FeedSessionCard", () => ({
  FeedSessionCard: ({ item }: { item: { feedItemId: string } }) => (
    <div>session-{item.feedItemId}</div>
  ),
}));

vi.mock("../../src/components/feed/CommentSection", () => ({
  CommentSection: () => <div>comments</div>,
}));

const item = {
  feedItemId: "f-1",
  commentsCount: 2,
};

describe("FeedView", () => {
  beforeEach(() => {
    getFeed.mockReset().mockResolvedValue({ items: [item] });
    showToast.mockReset();
  });

  it("renders feed items and can load more", async () => {
    render(<FeedView itemsPerPage={1} />);
    expect(await screen.findByText("session-f-1")).toBeInTheDocument();
    expect(getFeed).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1, offset: 0, sort: "date" }),
    );

    getFeed.mockResolvedValueOnce({ items: [{ feedItemId: "f-2", commentsCount: 0 }] });
    fireEvent.click(screen.getByRole("button", { name: "feed.loadMore" }));
    expect(await screen.findByText("session-f-2")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    getFeed.mockResolvedValue({ items: [] });
    render(<FeedView />);
    expect(await screen.findByText("feed.empty.title")).toBeInTheDocument();
  });

  it("toasts when loading fails", async () => {
    getFeed.mockRejectedValue(new Error("fail"));
    render(<FeedView />);
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.loadError.title",
        message: "feed.loadError.message",
      }),
    );
  });

  it("expands comments when enabled", async () => {
    render(<FeedView showComments />);
    expect(await screen.findByText("session-f-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "feed.comments.view" }));
    expect(screen.getByText("comments")).toBeInTheDocument();
  });
});
