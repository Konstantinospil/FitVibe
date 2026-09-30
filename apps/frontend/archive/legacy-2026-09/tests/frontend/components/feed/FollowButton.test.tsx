import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowButton } from "../../src/components/feed/FollowButton";

const followUser = vi.fn().mockResolvedValue(undefined);
const unfollowUser = vi.fn().mockResolvedValue(undefined);
const showToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({
    showToast,
  }),
}));

vi.mock("../../src/services/api", () => ({
  followUser: (...args: unknown[]) => followUser(...args),
  unfollowUser: (...args: unknown[]) => unfollowUser(...args),
}));

describe("FollowButton", () => {
  beforeEach(() => {
    followUser.mockReset().mockResolvedValue(undefined);
    unfollowUser.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("toggles follow and calls API", async () => {
    render(<FollowButton userAlias="alex" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.follow.follow" }));
    await waitFor(() => expect(followUser).toHaveBeenCalledWith("alex"));

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "feed.follow.following",
    });
    expect(screen.getByRole("button", { name: "feed.follow.unfollow" })).toBeInTheDocument();
  });

  it("handles unfollow", async () => {
    render(<FollowButton userAlias="alex" initialFollowing />);

    fireEvent.click(screen.getByRole("button", { name: "feed.follow.unfollow" }));
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith("alex"));
    expect(showToast).toHaveBeenCalledWith({
      variant: "info",
      title: "feed.follow.unfollowed",
    });
  });

  it("notifies parent on follow change", async () => {
    const onFollowChange = vi.fn();
    render(<FollowButton userAlias="alex" onFollowChange={onFollowChange} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.follow.follow" }));

    await waitFor(() => expect(onFollowChange).toHaveBeenCalledWith(true));
  });

  it("reverts optimistic follow on error", async () => {
    followUser.mockRejectedValue(new Error("Boom"));
    render(<FollowButton userAlias="alex" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.follow.follow" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.follow.error.title",
        message: "feed.follow.error.message",
      }),
    );
    expect(screen.getByRole("button", { name: "feed.follow.follow" })).toBeInTheDocument();
  });

  it("reverts optimistic unfollow on error", async () => {
    unfollowUser.mockRejectedValue(new Error("Boom"));
    render(<FollowButton userAlias="alex" initialFollowing />);

    fireEvent.click(screen.getByRole("button", { name: "feed.follow.unfollow" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.follow.error.title",
        message: "feed.follow.error.message",
      }),
    );
    expect(screen.getByRole("button", { name: "feed.follow.unfollow" })).toBeInTheDocument();
  });

  it("uses primary variant when not following", () => {
    render(<FollowButton userAlias="alex" />);

    expect(screen.getByRole("button", { name: "feed.follow.follow" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });

  it("prevents duplicate requests while loading", async () => {
    let resolveFollow: () => void = () => {};
    const followPromise = new Promise<void>((resolve) => {
      resolveFollow = resolve;
    });
    followUser.mockReturnValue(followPromise);

    render(<FollowButton userAlias="alex" />);

    const button = screen.getByRole("button", { name: "feed.follow.follow" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(followUser).toHaveBeenCalledTimes(1);
    resolveFollow();
    await followPromise;
  });
});
