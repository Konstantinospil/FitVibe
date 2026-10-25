import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstLoginTwoFactorPrompt } from "../../../apps/frontend/src/components/FirstLoginTwoFactorPrompt";
import { dismiss2FAInvitation, get2FAStatus } from "../../../apps/frontend/src/services/api";

const auth = vi.hoisted(() => ({ current: { isAuthenticated: true, user: { id: "user-1" } } }));
vi.mock("../../../apps/frontend/src/contexts/AuthContext", () => ({ useAuth: () => auth.current }));
vi.mock("../../../apps/frontend/src/services/api", () => ({ get2FAStatus: vi.fn(), dismiss2FAInvitation: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../apps/frontend/src/components/profile/TwoFactorManagement", () => ({
  TwoFactorManagement: ({ onStatusChanged, onBackupCodesFinished }: { onStatusChanged: () => Promise<unknown>; onBackupCodesFinished?: () => void }) =>
    <><button onClick={() => void onStatusChanged()}>Verify setup</button><button onClick={() => onBackupCodesFinished?.()}>Finish recovery codes</button></>,
}));
vi.mock("../../../apps/frontend/src/components/composites/Modal", () => ({
  Modal: ({ open, title, children, footer, onClose }: {
    open: boolean; title: React.ReactNode; children: React.ReactNode;
    footer: React.ReactNode; onClose: () => void;
  }) => open ? <div role="dialog" aria-label={String(title)}>
    <button onClick={onClose}>Close</button>{children}{footer}
  </div> : null,
}));

describe("first-login 2FA invitation", () => {
  beforeEach(() => {
    vi.mocked(dismiss2FAInvitation).mockResolvedValue(undefined);
    vi.clearAllMocks();
    auth.current = { isAuthenticated: true, user: { id: "user-1" } };
    vi.mocked(get2FAStatus).mockResolvedValue({ enabled: false });
  });

  it("offers 2FA before resolving the next onboarding dialog", async () => {
    const resolved = vi.fn();
    render(<FirstLoginTwoFactorPrompt onResolved={resolved} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(resolved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("firstLogin2fa.notNow"));
    await waitFor(() => expect(dismiss2FAInvitation).toHaveBeenCalledOnce());
    await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
  });

  it("does not prompt on another device after account-level dismissal", async () => {
    vi.mocked(get2FAStatus).mockResolvedValueOnce({ enabled: false, invitationDismissed: true });
    const resolved = vi.fn();
    render(<FirstLoginTwoFactorPrompt onResolved={resolved} />);
    await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(get2FAStatus).toHaveBeenCalledOnce();
  });

  it("does not prompt accounts with 2FA enabled", async () => {
    vi.mocked(get2FAStatus).mockResolvedValueOnce({ enabled: true });
    const resolved = vi.fn();
    render(<FirstLoginTwoFactorPrompt onResolved={resolved} />);
    await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the invitation open throughout setup and resolves on verified activation", async () => {
    vi.mocked(get2FAStatus).mockResolvedValueOnce({ enabled: false }).mockResolvedValueOnce({ enabled: true });
    const resolved = vi.fn();
    render(<FirstLoginTwoFactorPrompt onResolved={resolved} />);
    fireEvent.click(await screen.findByText("firstLogin2fa.activate"));
    expect(resolved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Verify setup"));
    await waitFor(() => expect(get2FAStatus).toHaveBeenCalledTimes(2));
    expect(resolved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Finish recovery codes"));
    await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
  });

  it("does not block subsequent onboarding if status is unavailable", async () => {
    vi.mocked(get2FAStatus).mockRejectedValueOnce(new Error("Network"));
    const resolved = vi.fn();
    render(<FirstLoginTwoFactorPrompt onResolved={resolved} />);
    await waitFor(() => expect(resolved).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
