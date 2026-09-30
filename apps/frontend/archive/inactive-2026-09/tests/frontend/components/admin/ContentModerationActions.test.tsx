import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentModerationActions } from "../../src/components/admin/ContentModerationActions";

const moderateContent = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  moderateContent: (...args: unknown[]) => moderateContent(...args),
}));

describe("ContentModerationActions", () => {
  beforeEach(() => {
    moderateContent.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("hides content with notes", async () => {
    const onActionComplete = vi.fn();
    render(<ContentModerationActions reportId="r-1" onActionComplete={onActionComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "admin.moderation.hide" }));
    fireEvent.change(screen.getByPlaceholderText("admin.moderation.notesPlaceholder"), {
      target: { value: "off topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    await waitFor(() =>
      expect(moderateContent).toHaveBeenCalledWith("r-1", { action: "hide", notes: "off topic" }),
    );
    expect(onActionComplete).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "admin.moderation.actionSuccess",
      message: "admin.moderation.actionMessage",
    });
  });

  it("dismisses, bans, cancels, and reports errors", async () => {
    render(<ContentModerationActions reportId="r-1" />);

    fireEvent.click(screen.getByRole("button", { name: "admin.moderation.dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    await waitFor(() =>
      expect(moderateContent).toHaveBeenCalledWith("r-1", { action: "dismiss", notes: undefined }),
    );

    moderateContent.mockRejectedValueOnce(new Error("fail"));
    fireEvent.click(screen.getByRole("button", { name: "admin.moderation.ban" }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "admin.moderation.actionError",
        message: "admin.moderation.actionErrorMessage",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "admin.moderation.hide" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("button", { name: "common.confirm" })).not.toBeInTheDocument();
  });
});
