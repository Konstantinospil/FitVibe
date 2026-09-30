import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloneSessionButton } from "../../src/components/feed/CloneSessionButton";

const cloneSessionFromFeed = vi.fn().mockResolvedValue({ sessionId: "new-1" });
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
  cloneSessionFromFeed: (...args: unknown[]) => cloneSessionFromFeed(...args),
}));

describe("CloneSessionButton", () => {
  beforeEach(() => {
    cloneSessionFromFeed.mockReset().mockResolvedValue({ sessionId: "new-1" });
    showToast.mockReset();
  });

  it("clones a session and reports success", async () => {
    const onCloneSuccess = vi.fn();
    render(<CloneSessionButton sessionId="s-1" onCloneSuccess={onCloneSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.clone.clone" }));
    await waitFor(() => expect(cloneSessionFromFeed).toHaveBeenCalledWith("s-1"));
    expect(onCloneSuccess).toHaveBeenCalledWith("new-1");
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "feed.clone.success",
      message: "feed.clone.message",
    });
  });

  it("shows an error toast when cloning fails", async () => {
    cloneSessionFromFeed.mockRejectedValue(new Error("fail"));
    render(<CloneSessionButton sessionId="s-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.clone.clone" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.clone.error.title",
        message: "feed.clone.error.message",
      }),
    );
  });

  it("ignores duplicate clicks while loading", async () => {
    let resolveClone: () => void = () => {};
    cloneSessionFromFeed.mockReturnValue(
      new Promise<{ sessionId: string }>((resolve) => {
        resolveClone = () => resolve({ sessionId: "new-1" });
      }),
    );

    render(<CloneSessionButton sessionId="s-1" variant="minimal" size="sm" />);
    const button = screen.getByRole("button", { name: "feed.clone.clone" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(cloneSessionFromFeed).toHaveBeenCalledTimes(1);
    resolveClone();
    await waitFor(() => expect(cloneSessionFromFeed).toHaveBeenCalledTimes(1));
  });
});
