import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookiePreferences } from "../../src/components/CookieConsent";
import { useCookieConsent } from "../../src/hooks/useCookieConsent";

vi.mock("../../src/hooks/useCookieConsent", async () => {
  const actual = await vi.importActual<typeof import("../../src/hooks/useCookieConsent")>(
    "../../src/hooks/useCookieConsent",
  );
  return { ...actual, useCookieConsent: vi.fn() };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const consent = vi.mocked(useCookieConsent);
const mockHook = (statusUnavailable: boolean) =>
  consent.mockReturnValue({
    consentStatus: { hasConsent: false },
    isLoading: false,
    error: null,
    statusUnavailable,
    savePreferences: vi.fn(),
    refreshStatus: vi.fn(),
  });

// issue 634: a transient consent-status failure must not re-prompt a visitor
// who already chose, but first-time visitors are still asked.
describe("initial cookie prompt when consent status is unavailable", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not re-prompt when this browser already recorded a choice", () => {
    localStorage.setItem("cookie-consent-banner-shown", "true");
    mockHook(true);
    render(<CookiePreferences initial />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still prompts a first-time visitor", () => {
    mockHook(true);
    render(<CookiePreferences initial />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prompts again when the server confirms there is no consent", () => {
    localStorage.setItem("cookie-consent-banner-shown", "true");
    mockHook(false);
    render(<CookiePreferences initial />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps settings controls available while the status is unavailable", () => {
    localStorage.setItem("cookie-consent-banner-shown", "true");
    mockHook(true);
    render(<CookiePreferences />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
