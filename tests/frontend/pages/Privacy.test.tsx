import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Privacy from "../../src/pages/Privacy";
import { ToastProvider } from "../../src/contexts/ToastContext";

const {
  authState,
  acceptPrivacyPolicy,
  revokePrivacyPolicy,
  getLegalDocumentsStatus,
  getPublishedLegalDocument,
} = vi.hoisted(() => ({
  authState: { isAuthenticated: false },
  acceptPrivacyPolicy: vi.fn(),
  revokePrivacyPolicy: vi.fn(),
  getLegalDocumentsStatus: vi.fn(),
  getPublishedLegalDocument: vi.fn(),
}));

vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: vi.fn((selector: (state: typeof authState) => unknown) => selector(authState)),
}));

vi.mock("../../src/services/api", () => ({
  acceptPrivacyPolicy,
  revokePrivacyPolicy,
  getLegalDocumentsStatus,
  getPublishedLegalDocument,
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
        "privacy.title": "Privacy Policy",
        "privacy.description": "How we handle your data",
        "privacy.consent.acknowledge": "Acknowledge",
        "privacy.consent.revoke": "Revoke acknowledgement",
      };
      return values[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const snapshot = {
  documentType: "privacy",
  version: "2026-09-25.1",
  changeClass: "material",
  userAction: "acknowledge",
  effectiveAt: "2026-09-25T10:00:00.000Z",
  publishedAt: "2026-09-25T09:00:00.000Z",
  language: "en",
  legacyWithoutSnapshot: false,
  content: {
    intro: "Published privacy introduction",
    section1: { title: "1. Scope", content: "Scope text" },
    section2: { title: "2. Who we are and how to contact us", email: "privacy@example.com" },
    section3: {
      title: "3. Information we collect",
      table: {
        headers: { category: "Category", examples: "Examples", source: "Source" },
        rows: {
          account: {
            category: "Account data",
            examples: "Email",
            source: "Provided by user",
          },
        },
      },
    },
  },
};

const renderPrivacy = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    </ToastProvider>,
  );

describe("Privacy page", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    acceptPrivacyPolicy.mockReset().mockResolvedValue({ message: "ok" });
    revokePrivacyPolicy.mockReset().mockResolvedValue({ message: "ok" });
    getLegalDocumentsStatus.mockReset();
    getPublishedLegalDocument.mockReset().mockResolvedValue(snapshot);
  });

  it("renders the authoritative published Privacy snapshot", async () => {
    renderPrivacy();

    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(await screen.findByText("Published privacy introduction")).toBeInTheDocument();
    expect(screen.getByText("1. Scope")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Account data")).toBeInTheDocument();
    expect(screen.getByText("privacy@example.com")).toBeInTheDocument();
  });

  it("records a required privacy acknowledgement", async () => {
    authState.isAuthenticated = true;
    getLegalDocumentsStatus
      .mockResolvedValueOnce({
        terms: {
          accepted: true,
          acceptedAt: null,
          acceptedVersion: "2024-06-01",
          currentVersion: "2024-06-01",
          requiredVersion: "2024-06-01",
          requiredAction: "accept",
          needsAcceptance: false,
        },
        privacy: {
          accepted: false,
          acceptedAt: null,
          acceptedVersion: null,
          currentVersion: "2026-09-25.1",
          requiredVersion: "2026-09-25.1",
          requiredAction: "acknowledge",
          needsAcceptance: true,
        },
      })
      .mockResolvedValueOnce({
        terms: {
          accepted: true,
          acceptedAt: null,
          acceptedVersion: "2024-06-01",
          currentVersion: "2024-06-01",
          requiredVersion: "2024-06-01",
          requiredAction: "accept",
          needsAcceptance: false,
        },
        privacy: {
          accepted: true,
          acceptedAt: "2026-09-25T11:00:00.000Z",
          acceptedVersion: "2026-09-25.1",
          currentVersion: "2026-09-25.1",
          requiredVersion: "2026-09-25.1",
          requiredAction: "acknowledge",
          needsAcceptance: false,
        },
      });

    renderPrivacy();
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));

    await waitFor(() => {
      expect(acceptPrivacyPolicy).toHaveBeenCalledWith({ privacy_policy_accepted: true });
    });
  });
});
