import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecuritySettings } from "../../src/components/profile/SecuritySettings";

const changePassword = vi.fn();
const get2FAStatus = vi.fn();
const disable2FA = vi.fn();
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
  changePassword: (...args: unknown[]) => changePassword(...args),
  get2FAStatus: (...args: unknown[]) => get2FAStatus(...args),
  disable2FA: (...args: unknown[]) => disable2FA(...args),
  setup2FA: vi.fn(),
  verify2FA: vi.fn(),
}));

vi.mock("../../src/components/auth/TwoFactorSetup", () => ({
  TwoFactorSetup: ({
    onSetupComplete,
    onCancel,
  }: {
    onSetupComplete: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={onSetupComplete}>
        complete-2fa
      </button>
      <button type="button" onClick={onCancel}>
        cancel-2fa
      </button>
    </div>
  ),
}));

describe("SecuritySettings", () => {
  beforeEach(() => {
    changePassword.mockReset().mockResolvedValue(undefined);
    get2FAStatus.mockReset().mockResolvedValue({ enabled: false });
    disable2FA.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("rejects mismatched and short passwords", async () => {
    render(<SecuritySettings />);
    await screen.findByText("settings.security.title");

    fireEvent.change(screen.getByLabelText(/settings.security.currentPassword/), {
      target: { value: "old-password-1" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.newPassword/), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.confirmPassword/), {
      target: { value: "other" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.updatePassword" }));
    expect(await screen.findByText("settings.security.passwordsDoNotMatch")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/settings.security.confirmPassword/), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.updatePassword" }));
    expect(await screen.findByText("settings.security.passwordTooShort")).toBeInTheDocument();
  });

  it("updates the password", async () => {
    const onUpdate = vi.fn();
    render(<SecuritySettings onUpdate={onUpdate} />);
    await screen.findByText("settings.security.title");

    fireEvent.change(screen.getByLabelText(/settings.security.currentPassword/), {
      target: { value: "old-password-1" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.newPassword/), {
      target: { value: "new-password-12" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.confirmPassword/), {
      target: { value: "new-password-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.updatePassword" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old-password-1",
        newPassword: "new-password-12",
      }),
    );
    expect(onUpdate).toHaveBeenCalled();
  });

  it("opens 2FA setup and can cancel", async () => {
    render(<SecuritySettings />);
    await screen.findByText("settings.security.enable2FA");

    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable2FA" }));
    expect(screen.getByText("settings.security.setup2FA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "cancel-2fa" }));
    expect(await screen.findByText("settings.security.enable2FA")).toBeInTheDocument();
  });

  it("disables 2FA when already enabled", async () => {
    get2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 8 });
    vi.spyOn(window, "prompt").mockReturnValueOnce("secret").mockReturnValueOnce("123456");
    render(<SecuritySettings />);

    expect(await screen.findByText("settings.security.2FAEnabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable2FA" }));
    await waitFor(() => expect(disable2FA).toHaveBeenCalledWith({ password: "secret", code: "123456" }));
  });

  it("ignores 2FA disable when the password prompt is cancelled", async () => {
    get2FAStatus.mockResolvedValue({ enabled: true });
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<SecuritySettings />);

    expect(
      await screen.findByRole("button", { name: "settings.security.disable2FA" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable2FA" }));
    expect(disable2FA).not.toHaveBeenCalled();
  });

  it("shows errors when password change or 2FA disable fails", async () => {
    get2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 3 });
    changePassword.mockRejectedValue(new Error("bad"));
    disable2FA.mockRejectedValue(new Error("nope"));
    vi.spyOn(window, "prompt").mockReturnValue("secret");

    render(<SecuritySettings />);
    expect(await screen.findByText("settings.security.2FAEnabled")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/settings.security.currentPassword/), {
      target: { value: "old-password-1" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.newPassword/), {
      target: { value: "new-password-12" },
    });
    fireEvent.change(screen.getByLabelText(/settings.security.confirmPassword/), {
      target: { value: "new-password-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.updatePassword" }));
    expect(await screen.findByText("settings.security.passwordChangeFailed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable2FA" }));
    expect(await screen.findByText("settings.security.2FADisableFailed")).toBeInTheDocument();
  });

  it("completes 2FA setup and ignores a failed status load", async () => {
    get2FAStatus.mockRejectedValue(new Error("offline"));
    const onUpdate = vi.fn();
    render(<SecuritySettings onUpdate={onUpdate} />);

    fireEvent.click(await screen.findByRole("button", { name: "settings.security.enable2FA" }));
    fireEvent.click(screen.getByRole("button", { name: "complete-2fa" }));
    expect(onUpdate).toHaveBeenCalled();
    expect(await screen.findByText("settings.security.2FAEnabled")).toBeInTheDocument();
  });
});
