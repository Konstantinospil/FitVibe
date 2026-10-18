import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CookieConsent, { CookiePreferences, REJECT_COOKIES, ACCEPT_COOKIES } from "../../../apps/frontend/src/components/CookieConsent";
import { useCookieConsent } from "../../../apps/frontend/src/hooks/useCookieConsent";

vi.mock("../../../apps/frontend/src/hooks/useCookieConsent", () => ({ useCookieConsent: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const save = vi.fn();
const consent = vi.mocked(useCookieConsent);

function mount(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue(undefined);
  consent.mockReturnValue({
    consentStatus: { hasConsent: false }, isLoading: false, error: null,
    savePreferences: save, refreshStatus: vi.fn(),
  });
});

describe("Cookie consent preferences", () => {
  it("shows four global switches with essential enabled and locked", () => {
    mount(<CookieConsent />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    expect(switches[0]).toBeChecked();
    expect(switches[0]).toBeDisabled();
    for (const optional of switches.slice(1)) expect(optional).not.toBeChecked();
  });

  it("X persists the exact reject-all selection", async () => {
    mount(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "cookie.actions.closeReject" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(REJECT_COOKIES, "banner"));
  });

  it("accept-all and reject-all persist immediately", async () => {
    mount(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "cookie.actions.acceptAll" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(ACCEPT_COOKIES, "banner"));
    await waitFor(() => expect(screen.getByRole("button", { name: "cookie.actions.rejectAll" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "cookie.actions.rejectAll" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(REJECT_COOKIES));
  });

  it("persists independently selected optional categories", async () => {
    mount(<CookieConsent />);
    fireEvent.click(screen.getByRole("switch", { name: "cookie.categories.analytics.label" }));
    fireEvent.click(screen.getByRole("switch", { name: "cookie.categories.preferences.label" }));
    fireEvent.click(screen.getByRole("button", { name: "cookie.actions.savePreferences" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({
      essential: true, preferences: true, analytics: true, marketing: false,
    }, "banner"));
  });

  it("keeps consent interface accessible when persistence fails", async () => {
    save.mockRejectedValue(new Error("backend unavailable"));
    mount(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "cookie.actions.closeReject" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cookie.actions.saveError");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("initial popup is absent when a valid choice was already recorded", () => {
    consent.mockReturnValue({
      consentStatus: { hasConsent: true, consent: {
        essential: true, preferences: false, analytics: false, marketing: false,
        version: "v1", updatedAt: "2026-10-18",
      } }, isLoading: false, error: null, savePreferences: save, refreshStatus: vi.fn(),
    });
    mount(<CookieConsent />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("settings preferences reflect existing saved category choices", () => {
    consent.mockReturnValue({
      consentStatus: { hasConsent: true, consent: {
        essential: true, preferences: true, analytics: false, marketing: true,
        version: "v1", updatedAt: "2026-10-18",
      } }, isLoading: false, error: null, savePreferences: save, refreshStatus: vi.fn(),
    });
    mount(<CookiePreferences />);
    const values = screen.getAllByRole("switch");
    expect(values.map(v => (v as HTMLInputElement).checked)).toEqual([true,true,false,true]);
  });
});
