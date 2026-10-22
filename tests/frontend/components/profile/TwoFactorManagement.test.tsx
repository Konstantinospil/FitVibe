import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TwoFactorManagement } from "../../../../apps/frontend/src/components/profile/TwoFactorManagement";
import * as api from "../../../../apps/frontend/src/services/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../../apps/frontend/src/services/api", () => ({
  setup2FA: vi.fn(),
  restart2FASetup: vi.fn(),
  verify2FA: vi.fn(),
  disable2FA: vi.fn(),
  regenerate2FABackupCodes: vi.fn(),
}));

const setupResponse = {
  secret: "TESTSECRET",
  qrCode: "data:image/png;base64,AAAA",
  backupCodes: ["CODE-ONE", "CODE-TWO"],
  message: "Ready",
};

describe("TwoFactorManagement", () => {
  const onStatusChanged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onStatusChanged.mockResolvedValue(undefined);
    vi.mocked(api.setup2FA).mockResolvedValue(setupResponse);
    vi.mocked(api.verify2FA).mockResolvedValue({ success: true, message: "Enabled" });
    vi.mocked(api.disable2FA).mockResolvedValue({ success: true, message: "Disabled" });
    vi.mocked(api.regenerate2FABackupCodes).mockResolvedValue({
      message: "Regenerated",
      backupCodes: ["NEW-CODE"],
    });
  });

  it("enrolls only after a valid TOTP and refreshes server status", async () => {
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    expect(await screen.findByAltText("settings.security.qrAlt")).toHaveAttribute(
      "src",
      setupResponse.qrCode,
    );
    const input = screen.getByLabelText("settings.security.enterCode");
    fireEvent.change(input, { target: { value: "123" } });
    expect(screen.getByRole("button", { name: "settings.security.verifyEnable" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "1234567x" } });
    expect(input).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "settings.security.verifyEnable" }));
    await waitFor(() => expect(api.verify2FA).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(onStatusChanged).toHaveBeenCalledOnce());
  });

  it("reports enrollment API errors without claiming successful setup", async () => {
    vi.mocked(api.setup2FA).mockRejectedValueOnce(new Error("Network"));
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.enableError");
    expect(screen.queryByAltText("settings.security.qrAlt")).not.toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

  it("rejects failed verification and retains the enrollment form", async () => {
    vi.mocked(api.verify2FA).mockResolvedValueOnce({ success: false, message: "Rejected" });
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    const input = await screen.findByLabelText("settings.security.enterCode");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.verifyEnable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.verifyError");
    expect(input).toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

  it("cancels enrollment without preserving sensitive codes", async () => {
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    await screen.findByAltText("settings.security.qrAlt");
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByText("TESTSECRET")).not.toBeInTheDocument();
    expect(screen.queryByText("CODE-ONE")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "settings.security.enable" })).toBeEnabled();
  });

  it("requires password and code to disable then refreshes status", async () => {
    render(<TwoFactorManagement enabled onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable" }));
    const confirm = screen.getByRole("button", { name: "settings.security.confirmDisable" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("settings.security.enterCode"), {
      target: { value: "123456" },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.disable2FA).toHaveBeenCalledWith({
      password: "password",
      code: "123456",
    }));
    await waitFor(() => expect(onStatusChanged).toHaveBeenCalledOnce());
  });

  it("retains the step-up prompt after a rejected disable request", async () => {
    vi.mocked(api.disable2FA).mockRejectedValueOnce(new Error("Incorrect factor"));
    render(<TwoFactorManagement enabled onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable" }));
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("settings.security.enterCode"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.confirmDisable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.disableError");
    expect(onStatusChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "settings.security.confirmDisable" })).toBeEnabled();
  });

  it("regenerates backup codes and hides them until explicitly revealed", async () => {
    render(<TwoFactorManagement enabled onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.backupCodes" }));
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("settings.security.enterCode"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.backupCodes" }));
    await waitFor(() => expect(api.regenerate2FABackupCodes).toHaveBeenCalledWith({
      password: "password",
      code: "123456",
    }));
    expect(screen.queryByText("NEW-CODE")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.security.revealBackupCodes" }));
    expect(screen.getByText("NEW-CODE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.security.hideBackupCodes" }));
    expect(screen.queryByText("NEW-CODE")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.security.finishBackupCodes" }));
    expect(screen.queryByText("NEW-CODE")).not.toBeInTheDocument();
  });
  it("shows verification API failures without changing security status", async () => {
    vi.mocked(api.verify2FA).mockRejectedValueOnce(new Error("Unavailable"));
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    fireEvent.change(await screen.findByLabelText("settings.security.enterCode"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.verifyEnable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.verifyError");
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

  it("cancels step-up before sending any disabling request", () => {
    render(<TwoFactorManagement enabled onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.disable" }));
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "unsubmitted-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(api.disable2FA).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("unsubmitted-password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "settings.security.disable" })).toBeEnabled();
  });

  it("preserves the step-up form if regeneration fails", async () => {
    vi.mocked(api.regenerate2FABackupCodes).mockRejectedValueOnce(new Error("Invalid verification"));
    render(<TwoFactorManagement enabled onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.backupCodes" }));
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("settings.security.enterCode"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.security.backupCodes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.disableError");
    expect(screen.getByDisplayValue("password")).toBeInTheDocument();
    expect(screen.queryByText("NEW-CODE")).not.toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

  it("recovers interrupted enrollment only after password step-up", async () => {
    vi.mocked(api.setup2FA).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { code: "2FA_SETUP_RESTART_REQUIRES_STEP_UP" } },
    });
    vi.mocked(api.restart2FASetup).mockResolvedValueOnce(setupResponse);
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    const restart = await screen.findByRole("button", { name: "Restart 2FA setup" });
    expect(restart).toBeDisabled();
    expect(api.restart2FASetup).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(restart);
    await waitFor(() =>
      expect(api.restart2FASetup).toHaveBeenCalledWith({ password: "correct-password", code: "" }),
    );
    expect(await screen.findByAltText("settings.security.qrAlt")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("correct-password")).not.toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

  it("keeps restart guarded when step-up authentication fails", async () => {
    vi.mocked(api.setup2FA).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { code: "2FA_SETUP_RESTART_REQUIRES_STEP_UP" } },
    });
    vi.mocked(api.restart2FASetup).mockRejectedValueOnce(new Error("Unauthorized"));
    render(<TwoFactorManagement enabled={false} onStatusChanged={onStatusChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.security.enable" }));
    fireEvent.change(await screen.findByLabelText("settings.security.disablePasswordLabel"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restart 2FA setup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings.security.enableError");
    expect(screen.queryByAltText("settings.security.qrAlt")).not.toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });

});
