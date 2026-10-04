import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "../../src/components/feed/ShareButton";

const createShareLink = vi.fn();
const revokeShareLink = vi.fn();
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
  createShareLink: (...args: unknown[]) => createShareLink(...args),
  revokeShareLink: (...args: unknown[]) => revokeShareLink(...args),
}));

describe("ShareButton", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    createShareLink.mockReset().mockResolvedValue({ url: "https://fitvibe.app/s/1" });
    revokeShareLink.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("creates a share link and copies it", async () => {
    const onShareLinkCreated = vi.fn();
    render(<ShareButton feedItemId="item-1" onShareLinkCreated={onShareLinkCreated} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.share.share" }));
    await waitFor(() => expect(createShareLink).toHaveBeenCalledWith("item-1"));
    expect(onShareLinkCreated).toHaveBeenCalledWith("https://fitvibe.app/s/1");

    fireEvent.click(screen.getByRole("button", { name: "feed.share.copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://fitvibe.app/s/1"));
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "feed.share.copied",
    });
  });

  it("builds a URL from a token when the API omits url", async () => {
    createShareLink.mockResolvedValue({ token: "abc" });
    render(<ShareButton feedItemId="item-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.share.share" }));
    expect(
      await screen.findByDisplayValue(`${window.location.origin}/feed/link/abc`),
    ).toBeInTheDocument();
  });

  it("revokes an existing share URL", async () => {
    render(<ShareButton feedItemId="item-1" shareUrl="https://fitvibe.app/s/1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.share.share" }));
    fireEvent.click(screen.getByRole("button", { name: "feed.share.revoke" }));
    await waitFor(() => expect(revokeShareLink).toHaveBeenCalledWith("item-1"));
    expect(showToast).toHaveBeenCalledWith({
      variant: "info",
      title: "feed.share.revoked",
    });
  });

  it("shows an error when creating a link fails", async () => {
    createShareLink.mockRejectedValue(new Error("fail"));
    render(<ShareButton feedItemId="item-1" variant="minimal" size="sm" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.share.share" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "feed.share.error.title",
        message: "feed.share.error.message",
      }),
    );
  });
});
