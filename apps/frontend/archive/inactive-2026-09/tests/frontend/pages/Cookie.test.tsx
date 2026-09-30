import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Cookie from "../../src/pages/Cookie";
import { ToastProvider } from "../../src/contexts/ToastContext";

const { getPublishedLegalDocument, savePreferences, consentState } = vi.hoisted(() => ({
  getPublishedLegalDocument: vi.fn(),
  savePreferences: vi.fn(),
  consentState: {
    consentStatus: {
      hasConsent: true,
      consent: {
        essential: true,
        preferences: true,
        analytics: true,
        marketing: false,
        version: "2026-09-25.1",
        updatedAt: "2026-09-25T10:00:00.000Z",
      },
    },
    isLoading: false,
  },
}));

vi.mock("../../src/services/api", () => ({
  getPublishedLegalDocument,
}));

vi.mock("../../src/hooks/useCookieConsent", () => ({
  useCookieConsent: () => ({
    ...consentState,
    savePreferences,
  }),
}));

vi.mock("../../src/i18n/config", () => ({
  ensureLegalTranslationsLoaded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "en",
      getResourceBundle: vi.fn(() => ({})),
    },
    t: (key: string, options?: { defaultValue?: string }) => {
      const values: Record<string, string> = {
        "navigation.back": "Back",
        "cookie.policy.title": "Cookie Policy",
        "cookie.policy.description": "How we use cookies",
        "cookie.revokeConsent": "Withdraw optional cookie consent",
      };
      return values[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const snapshot = {
  documentType: "cookie",
  version: "2026-09-25.1",
  changeClass: "material",
  userAction: "renew_consent",
  effectiveAt: "2026-09-25T10:00:00.000Z",
  publishedAt: "2026-09-25T09:00:00.000Z",
  language: "en",
  legacyWithoutSnapshot: false,
  content: {
    intro: "Published cookie introduction",
    section1: { title: "1. What are cookies?", content: "Cookie explanation" },
    section2: { title: "2. Types of cookies", items: ["Essential cookies", "Functional cookies"] },
  },
};

const renderCookie = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <Cookie />
      </MemoryRouter>
    </ToastProvider>,
  );

describe("Cookie page", () => {
  beforeEach(() => {
    getPublishedLegalDocument.mockReset().mockResolvedValue(snapshot);
    savePreferences.mockReset().mockResolvedValue(undefined);
    consentState.consentStatus.hasConsent = true;
    consentState.isLoading = false;
  });

  it("renders the authoritative published Cookie snapshot", async () => {
    renderCookie();

    expect(screen.getByText("Cookie Policy")).toBeInTheDocument();
    expect(await screen.findByText("Published cookie introduction")).toBeInTheDocument();
    expect(screen.getByText("1. What are cookies?")).toBeInTheDocument();
    expect(screen.getByText("Essential cookies")).toBeInTheDocument();
  });

  it("withdraws optional consent without revoking Terms", async () => {
    renderCookie();

    fireEvent.click(
      await screen.findByRole("button", { name: "Withdraw optional cookie consent" }),
    );

    await waitFor(() => {
      expect(savePreferences).toHaveBeenCalledWith({
        essential: true,
        preferences: false,
        analytics: false,
        marketing: false,
      });
    });
  });
});
