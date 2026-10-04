import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LikeButton } from "../../src/components/feed/LikeButton";

const likeFeedItem = vi.fn().mockResolvedValue(undefined);
const unlikeFeedItem = vi.fn().mockResolvedValue(undefined);
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
  likeFeedItem: (...args: unknown[]) => likeFeedItem(...args),
  unlikeFeedItem: (...args: unknown[]) => unlikeFeedItem(...args),
}));

describe("LikeButton", () => {
  beforeEach(() => {
    likeFeedItem.mockReset().mockResolvedValue(undefined);
    unlikeFeedItem.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("likes a feed item and reports the new count", async () => {
    const onLikeChange = vi.fn();
    render(<LikeButton feedItemId="item-1" initialCount={2} onLikeChange={onLikeChange} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.like.like" }));
    await waitFor(() => expect(likeFeedItem).toHaveBeenCalledWith("item-1"));
    expect(onLikeChange).toHaveBeenCalledWith(true, 3);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("unlikes a feed item", async () => {
    render(<LikeButton feedItemId="item-1" initialLiked initialCount={1} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.like.unlike" }));
    await waitFor(() => expect(unlikeFeedItem).toHaveBeenCalledWith("item-1"));
  });

  it("reverts on error and shows a toast", async () => {
    likeFeedItem.mockRejectedValue(new Error("fail"));
    render(<LikeButton feedItemId="item-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.like.like" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.like.error.title",
        message: "feed.like.error.message",
      }),
    );
    expect(screen.getByRole("button", { name: "feed.like.like" })).toBeInTheDocument();
  });

  it("ignores duplicate clicks while loading and supports minimal variant", async () => {
    let resolveLike: () => void = () => {};
    likeFeedItem.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLike = resolve;
      }),
    );

    render(<LikeButton feedItemId="item-1" variant="minimal" size="sm" />);
    const button = screen.getByRole("button", { name: "feed.like.like" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(likeFeedItem).toHaveBeenCalledTimes(1);
    resolveLike();
    await waitFor(() => expect(likeFeedItem).toHaveBeenCalledTimes(1));
  });
});
