import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserModerationActions } from "../../src/components/admin/UserModerationActions";

const suspendUser = vi.fn();
const unsuspendUser = vi.fn();
const banUser = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  suspendUser: (...args: unknown[]) => suspendUser(...args),
  unsuspendUser: (...args: unknown[]) => unsuspendUser(...args),
  banUser: (...args: unknown[]) => banUser(...args),
}));

describe("UserModerationActions", () => {
  beforeEach(() => {
    suspendUser.mockReset().mockResolvedValue(undefined);
    unsuspendUser.mockReset().mockResolvedValue(undefined);
    banUser.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("suspends an active user with reason and notes", async () => {
    const onActionComplete = vi.fn();
    render(
      <UserModerationActions
        userId="u-1"
        currentStatus="active"
        onActionComplete={onActionComplete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "admin.users.suspend" }));
    fireEvent.change(screen.getByLabelText("admin.users.reason"), {
      target: { value: "spam" },
    });
    fireEvent.change(screen.getByPlaceholderText("admin.users.notesPlaceholder"), {
      target: { value: "repeat offender" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    await waitFor(() =>
      expect(suspendUser).toHaveBeenCalledWith("u-1", {
        reason: "spam",
        notes: "repeat offender",
      }),
    );
    expect(onActionComplete).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "admin.users.actionSuccess",
      message: "admin.users.actionMessage",
    });
  });

  it("unsuspends and bans, and reports errors", async () => {
    const { rerender } = render(<UserModerationActions userId="u-1" currentStatus="suspended" />);
    fireEvent.click(screen.getByRole("button", { name: "admin.users.unsuspend" }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    await waitFor(() =>
      expect(unsuspendUser).toHaveBeenCalledWith("u-1", { reason: undefined, notes: undefined }),
    );

    rerender(<UserModerationActions userId="u-1" currentStatus="active" />);
    banUser.mockRejectedValueOnce(new Error("fail"));
    fireEvent.click(screen.getByRole("button", { name: "admin.users.ban" }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "admin.users.actionError",
        message: "admin.users.actionErrorMessage",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "admin.users.ban" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("button", { name: "common.confirm" })).not.toBeInTheDocument();

    rerender(<UserModerationActions userId="u-1" currentStatus="banned" />);
    expect(screen.queryByRole("button", { name: "admin.users.ban" })).not.toBeInTheDocument();
  });
});
