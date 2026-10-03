import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommentSection } from "../../src/components/feed/CommentSection";
import type { Comment } from "../../src/services/api";

const getFeedItemComments = vi.fn();
const addComment = vi.fn();
const deleteComment = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  getFeedItemComments: (...args: unknown[]) => getFeedItemComments(...args),
  addComment: (...args: unknown[]) => addComment(...args),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
}));

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c-1",
    feedItemId: "item-1",
    userId: "user-1",
    content: "Nice work",
    body: "Nice work",
    displayName: "Alex",
    username: "alex",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

describe("CommentSection", () => {
  beforeEach(() => {
    getFeedItemComments.mockReset().mockResolvedValue({ comments: [] });
    addComment.mockReset();
    deleteComment.mockReset();
    showToast.mockReset();
  });

  it("shows empty state after loading", async () => {
    render(<CommentSection feedItemId="item-1" />);
    expect(await screen.findByText("feed.comments.empty")).toBeInTheDocument();
  });

  it("does not load comments when autoLoad is false", () => {
    render(<CommentSection feedItemId="item-1" autoLoad={false} />);
    expect(getFeedItemComments).not.toHaveBeenCalled();
    expect(screen.getByText("feed.comments.empty")).toBeInTheDocument();
  });

  it("toasts when comments fail to load", async () => {
    getFeedItemComments.mockRejectedValue(new Error("fail"));
    render(<CommentSection feedItemId="item-1" />);
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.comments.loadError.title",
        message: "feed.comments.loadError.message",
      }),
    );
  });

  it("renders comments and relative timestamps", async () => {
    const now = Date.now();
    getFeedItemComments.mockResolvedValue({
      comments: [
        makeComment({ id: "c-now", createdAt: new Date(now - 10_000).toISOString() }),
        makeComment({
          id: "c-mins",
          body: "Five minutes",
          createdAt: new Date(now - 5 * 60_000).toISOString(),
          deletedAt: null,
        }),
        makeComment({
          id: "c-hours",
          body: "Two hours",
          createdAt: new Date(now - 2 * 3_600_000).toISOString(),
        }),
        makeComment({
          id: "c-days",
          body: "Three days",
          createdAt: new Date(now - 3 * 86_400_000).toISOString(),
        }),
        makeComment({
          id: "c-old",
          body: "Last year",
          createdAt: "2020-01-15T12:00:00.000Z",
        }),
        makeComment({ id: "c-deleted", body: "gone", deletedAt: "2026-01-01T00:00:00.000Z" }),
      ],
    });

    render(<CommentSection feedItemId="item-1" />);
    expect(await screen.findByText("Nice work")).toBeInTheDocument();
    expect(screen.getByText("Five minutes")).toBeInTheDocument();
    expect(screen.getByText("Two hours")).toBeInTheDocument();
    expect(screen.getByText("Three days")).toBeInTheDocument();
    expect(screen.getByText("Last year")).toBeInTheDocument();
    expect(screen.queryByText("gone")).not.toBeInTheDocument();
  });

  it("posts a comment and notifies the parent", async () => {
    const created = makeComment({ id: "c-new", body: "Great session" });
    addComment.mockResolvedValue({ comment: created });
    const onCommentAdded = vi.fn();

    render(
      <CommentSection feedItemId="item-1" currentUserId="user-1" onCommentAdded={onCommentAdded} />,
    );
    await screen.findByText("feed.comments.empty");

    fireEvent.change(screen.getByLabelText("feed.comments.addComment"), {
      target: { value: "Great session" },
    });
    fireEvent.submit(screen.getByLabelText("feed.comments.addComment").closest("form")!);

    await waitFor(() =>
      expect(addComment).toHaveBeenCalledWith("item-1", { body: "Great session" }),
    );
    expect(onCommentAdded).toHaveBeenCalledWith(created);
    expect(screen.getByText("Great session")).toBeInTheDocument();
  });

  it("ignores blank comments and restores text on add failure", async () => {
    addComment.mockRejectedValue(new Error("fail"));
    render(<CommentSection feedItemId="item-1" currentUserId="user-1" />);
    await screen.findByText("feed.comments.empty");

    const input = screen.getByLabelText("feed.comments.addComment");
    fireEvent.submit(input.closest("form")!);
    expect(addComment).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(addComment).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.comments.addError.title",
        message: "feed.comments.addError.message",
      }),
    );
    expect(input).toHaveValue("Hello");
  });

  it("deletes own comments and toasts on failure", async () => {
    getFeedItemComments.mockResolvedValue({
      comments: [makeComment({ id: "c-1", userId: "user-1", body: "Mine" })],
    });
    deleteComment.mockResolvedValue(undefined);
    const onCommentDeleted = vi.fn();

    render(
      <CommentSection
        feedItemId="item-1"
        currentUserId="user-1"
        onCommentDeleted={onCommentDeleted}
      />,
    );
    expect(await screen.findByText("Mine")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "feed.comments.delete" }));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith("c-1"));
    expect(onCommentDeleted).toHaveBeenCalledWith("c-1");
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "feed.comments.deleted",
    });
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();
  });

  it("does not show delete for other users and reports delete errors", async () => {
    getFeedItemComments.mockResolvedValue({
      comments: [makeComment({ id: "c-2", userId: "other", body: "Theirs" })],
    });
    render(<CommentSection feedItemId="item-1" currentUserId="user-1" />);
    expect(await screen.findByText("Theirs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "feed.comments.delete" })).not.toBeInTheDocument();
  });

  it("toasts when delete fails", async () => {
    getFeedItemComments.mockResolvedValue({
      comments: [makeComment({ id: "c-1", userId: "user-1", body: "Mine" })],
    });
    deleteComment.mockRejectedValue(new Error("fail"));

    render(<CommentSection feedItemId="item-1" currentUserId="user-1" />);
    expect(await screen.findByText("Mine")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "feed.comments.delete" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.comments.deleteError.title",
        message: "feed.comments.deleteError.message",
      }),
    );
    expect(screen.getByText("Mine")).toBeInTheDocument();
  });
});
