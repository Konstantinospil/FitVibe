import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Terms from "../../src/pages/Terms";
import { ToastProvider } from "../../src/contexts/ToastContext";

const {
  authState,
  acceptTerms,
  revokeTerms,
  getLegalDocumentsStatus,
  getPublishedLegalDocument,
  mockNavigate,
} = vi.hoisted(() => ({
  authState: {
    isAuthenticated: false,
    signOut: vi.fn(),
  },
  acceptTerms: vi.fn(),
  revokeTerms: vi.fn(),
  getLegalDocumentsStatus: vi.fn(),
  getPublishedLegalDocument: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: vi.fn((selector: (state: typeof authState) => unknown) => selector(authState)),
}));

vi.mock("../../src/services/api", () => ({
  acceptTerms,
  revokeTerms,
  getLegalDocumentsStatus,
  getPublishedLegalDocument,
}));

vi.mock("../../src/i18n/config", () => ({
  ensureLegalTranslationsLoaded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "en",
      getResourceBundle: vi.fn(() => ({})),
    },
    t: (key: string, options?: { defaultValue?: string }) => {
      const values: Record<string, string> = {
        "navigation.back": "Back",
        "terms.title": "Terms and Conditions",
        "terms.description": "Terms of service",
        "terms.consent.accept": "Accept Terms and Conditions",
        "terms.consent.accepting": "Accepting...",
        "terms.consent.revoke": "Revoke consent",
        "terms.consent.revokeConfirm.title": "Revoke Terms consent?",
        "terms.consent.revokeConfirm.message": "You will be signed out.",
        "terms.consent.revokeConfirm.confirm": "Revoke consent and log out",
        "terms.consent.revokeConfirm.cancel": "Back",
      };
      return values[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const snapshot = {
  documentType: "terms",
  version: "2026-09-25.1",
  changeClass: "material",
  userAction: "accept",
  effectiveAt: "2026-09-25T10:00:00.000Z",
  publishedAt: "2026-09-25T09:00:00.000Z",
  language: "en",
  legacyWithoutSnapshot: false,
  content: {
    intro: "Published terms introduction",
    section1: { title: "1. Eligibility and account registration", content: "Eligibility text" },
    section5: { title: "5. Health and safety notice", content: "Health notice" },
    section16: { title: "16. Contact", email: "legal@fitvibe.example.com" },
  },
};

const renderTerms = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <Terms />
      </MemoryRouter>
    </ToastProvider>,
  );

describe("Terms page", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.signOut = vi.fn();
    acceptTerms.mockReset().mockResolvedValue({ message: "ok" });
    revokeTerms.mockReset().mockResolvedValue({ message: "ok" });
    getLegalDocumentsStatus.mockReset();
    getPublishedLegalDocument.mockReset().mockResolvedValue(snapshot);
    mockNavigate.mockReset();
  });

  it("renders the authoritative published snapshot", async () => {
    renderTerms();

    expect(screen.getByText("Terms and Conditions")).toBeInTheDocument();
    expect(await screen.findByText("Published terms introduction")).toBeInTheDocument();
    expect(screen.getByText("1. Eligibility and account registration")).toBeInTheDocument();
    expect(screen.getByText("5. Health and safety notice")).toBeInTheDocument();
    expect(screen.getByText("legal@fitvibe.example.com")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains("legal-document-shell__version") === true &&
          element.textContent?.includes("2026-09-25.1") === true,
      ),
    ).toBeInTheDocument();
  });

  it("accepts the required published Terms version", async () => {
    authState.isAuthenticated = true;
    getLegalDocumentsStatus
      .mockResolvedValueOnce({
        terms: {
          accepted: false,
          acceptedAt: null,
          acceptedVersion: null,
          currentVersion: "2026-09-25.1",
          requiredVersion: "2026-09-25.1",
          requiredAction: "accept",
          needsAcceptance: true,
        },
        privacy: {
          accepted: true,
          acceptedAt: null,
          acceptedVersion: null,
          currentVersion: "2024-06-01",
          requiredVersion: "2024-06-01",
          requiredAction: "acknowledge",
          needsAcceptance: false,
        },
      })
      .mockResolvedValueOnce({
        terms: {
          accepted: true,
          acceptedAt: "2026-09-25T11:00:00.000Z",
          acceptedVersion: "2026-09-25.1",
          currentVersion: "2026-09-25.1",
          requiredVersion: "2026-09-25.1",
          requiredAction: "accept",
          needsAcceptance: false,
        },
        privacy: {
          accepted: true,
          acceptedAt: null,
          acceptedVersion: null,
          currentVersion: "2024-06-01",
          requiredVersion: "2024-06-01",
          requiredAction: "acknowledge",
          needsAcceptance: false,
        },
      });

    renderTerms();

    fireEvent.click(
      await screen.findByRole("button", { name: "Accept Terms and Conditions" }),
    );

    await waitFor(() => {
      expect(acceptTerms).toHaveBeenCalledWith({ terms_accepted: true });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("revokes Terms acceptance and signs the user out", async () => {
    authState.isAuthenticated = true;
    getLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: true,
        acceptedAt: "2026-09-25T11:00:00.000Z",
        acceptedVersion: "2026-09-25.1",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: false,
      },
      privacy: {
        accepted: true,
        acceptedAt: null,
        acceptedVersion: null,
        currentVersion: "2024-06-01",
        requiredVersion: "2024-06-01",
        requiredAction: "acknowledge",
        needsAcceptance: false,
      },
    });

    renderTerms();

    fireEvent.click(await screen.findByRole("button", { name: "Revoke consent" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Revoke consent and log out" }),
    );

    await waitFor(() => expect(revokeTerms).toHaveBeenCalled());
    expect(authState.signOut).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
