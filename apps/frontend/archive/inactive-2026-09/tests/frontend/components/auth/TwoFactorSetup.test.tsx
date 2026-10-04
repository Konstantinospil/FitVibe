import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TwoFactorSetup } from "../../src/components/auth/TwoFactorSetup";

const setup2FA = vi.fn();
const verify2FA = vi.fn();
const get2FAStatus = vi.fn();
const showToast = vi.fn();
const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  setup2FA: (...args: unknown[]) => setup2FA(...args),
  verify2FA: (...args: unknown[]) => verify2FA(...args),
  get2FAStatus: (...args: unknown[]) => get2FAStatus(...args),
}));

vi.mock("../../src/components/auth/BackupCodesDisplay", () => ({
  BackupCodesDisplay: ({ backupCodes }: { backupCodes: string[] }) => (
    <div>codes:{backupCodes.join(",")}</div>
  ),
}));

describe("TwoFactorSetup", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
    setup2FA.mockReset().mockResolvedValue({
      qrCode: "data:image/png;base64,abc",
      secret: "SECRET",
      backupCodes: ["AAAA", "BBBB"],
    });
    verify2FA.mockReset().mockResolvedValue({ success: true });
    get2FAStatus.mockReset().mockResolvedValue({ enabled: false });
    showToast.mockReset();
  });

  it("walks through setup, verification, and completion", async () => {
    const onSetupComplete = vi.fn();
    const onCancel = vi.fn();
    render(<TwoFactorSetup onSetupComplete={onSetupComplete} onCancel={onCancel} />);

    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    await waitFor(() => expect(setup2FA).toHaveBeenCalled());

    expect(screen.getByAltText("QR Code")).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(screen.getByText("SECRET")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.2fa.verify" }));

    await waitFor(() => expect(verify2FA).toHaveBeenCalledWith("123456"));
    expect(await screen.findByText("codes:AAAA,BBBB")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.done" }));
    expect(onSetupComplete).toHaveBeenCalled();
  });

  it("shows a setup error and supports cancel", async () => {
    setup2FA.mockRejectedValue(new Error("fail"));
    const onCancel = vi.fn();
    render(<TwoFactorSetup onCancel={onCancel} />);

    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    expect(await screen.findByText("auth.2fa.setupFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows a verification failure", async () => {
    verify2FA.mockResolvedValue({ success: false, message: "Bad code" });
    render(<TwoFactorSetup />);

    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    await screen.findByPlaceholderText("000000");
    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.2fa.verify" }));
    expect(await screen.findByText("Bad code")).toBeInTheDocument();
  });

  it("skips to backup when 2FA is already enabled", async () => {
    get2FAStatus.mockResolvedValue({ enabled: true });
    render(<TwoFactorSetup />);
    expect(await screen.findByText("auth.2fa.setupComplete")).toBeInTheDocument();
  });

  it("returns to setup from the verify step", async () => {
    render(<TwoFactorSetup />);
    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    await screen.findByPlaceholderText("000000");
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
    expect(await screen.findByRole("button", { name: "auth.2fa.startSetup" })).toBeInTheDocument();
  });

  it("ignores status errors and shows a verification exception", async () => {
    get2FAStatus.mockRejectedValue(new Error("offline"));
    setup2FA.mockResolvedValue({ qrCode: "", secret: "", backupCodes: [] });
    render(<TwoFactorSetup />);

    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    const codeInput = await screen.findByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "654321" } });
    verify2FA.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "auth.2fa.verify" }));
    expect(await screen.findByText("auth.2fa.verificationFailed")).toBeInTheDocument();
  });

  it("falls back when verification fails without a message", async () => {
    verify2FA.mockResolvedValue({ success: false });
    render(<TwoFactorSetup />);
    fireEvent.click(await screen.findByRole("button", { name: "auth.2fa.startSetup" }));
    const codeInput = await screen.findByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.2fa.verify" }));
    expect(await screen.findByText("auth.2fa.verificationFailed")).toBeInTheDocument();
  });

  it("uses English copy when translations are empty", async () => {
    tState.impl = () => "";
    render(<TwoFactorSetup onCancel={vi.fn()} />);
    expect(screen.getByText("Setup Two-Factor Authentication")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
