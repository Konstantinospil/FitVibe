import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarkButton } from "../../src/components/feed/BookmarkButton";

const bookmarkFeedItem = vi.fn().mockResolvedValue(undefined);
const unbookmarkFeedItem = vi.fn().mockResolvedValue(undefined);
const showToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  bookmarkFeedItem: (...args: unknown[]) => bookmarkFeedItem(...args),
  unbookmarkFeedItem: (...args: unknown[]) => unbookmarkFeedItem(...args),
}));

describe("BookmarkButton", () => {
  beforeEach(() => {
    bookmarkFeedItem.mockReset().mockResolvedValue(undefined);
    unbookmarkFeedItem.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("bookmarks an item", async () => {
    const onBookmarkChange = vi.fn();
    render(<BookmarkButton feedItemId="item-1" onBookmarkChange={onBookmarkChange} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.bookmark.add" }));
    await waitFor(() => expect(bookmarkFeedItem).toHaveBeenCalledWith("item-1"));
    expect(onBookmarkChange).toHaveBeenCalledWith(true);
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "feed.bookmark.added",
    });
  });

  it("removes a bookmark", async () => {
    render(<BookmarkButton feedItemId="item-1" initialBookmarked />);

    fireEvent.click(screen.getByRole("button", { name: "feed.bookmark.remove" }));
    await waitFor(() => expect(unbookmarkFeedItem).toHaveBeenCalledWith("item-1"));
    expect(showToast).toHaveBeenCalledWith({
      variant: "info",
      title: "feed.bookmark.removed",
    });
  });

  it("reverts on error", async () => {
    bookmarkFeedItem.mockRejectedValue(new Error("fail"));
    render(<BookmarkButton feedItemId="item-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.bookmark.add" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.bookmark.error.title",
        message: "feed.bookmark.error.message",
      }),
    );
    expect(screen.getByRole("button", { name: "feed.bookmark.add" })).toBeInTheDocument();
  });

  it("ignores duplicate clicks while loading", async () => {
    let resolveBookmark: () => void = () => {};
    bookmarkFeedItem.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveBookmark = resolve;
      }),
    );

    render(<BookmarkButton feedItemId="item-1" variant="minimal" size="lg" />);
    const button = screen.getByRole("button", { name: "feed.bookmark.add" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(bookmarkFeedItem).toHaveBeenCalledTimes(1);
    resolveBookmark();
    await waitFor(() => expect(bookmarkFeedItem).toHaveBeenCalledTimes(1));
  });
});
