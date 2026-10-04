import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CookieConsent from "../../src/components/CookieConsent";
import { useCookieConsent } from "../../src/hooks/useCookieConsent";
import { ToastProvider } from "../../src/contexts/ToastContext";

vi.mock("../../src/hooks/useCookieConsent");

const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../../src/contexts/ToastContext", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: () => mockToast,
}));

const mockSavePreferences = vi.fn();
const mockUseCookieConsent = vi.mocked(useCookieConsent);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "cookie.title": "Cookie Preferences",
        "cookie.description": "We use cookies to enhance your experience",
        "cookie.intro": "This website uses cookies",
        "cookie.categories.essential.label": "Essential Cookies",
        "cookie.categories.essential.description": "Required for the site to function",
        "cookie.categories.preferences.label": "Preferences",
        "cookie.categories.preferences.description": "Remember your preferences",
        "cookie.categories.analytics.label": "Analytics",
        "cookie.categories.analytics.description": "Help us improve the site",
        "cookie.categories.marketing.label": "Marketing",
        "cookie.categories.marketing.description": "Personalized advertising",
        "cookie.required": "Required",
        "cookie.enabled": "enabled",
        "cookie.disabled": "disabled",
        "cookie.policy.title": "Cookie Policy",
        "cookie.policy.description": "Read our cookie policy",
        "cookie.policy.link": "here",
        "cookie.actions.rejectAll": "Reject All",
        "cookie.actions.acceptAll": "Accept All",
        "cookie.actions.savePreferences": "Save Preferences",
        "cookie.actions.saveError": "Failed to save preferences",
      };
      return translations[key] || key;
    },
  }),
}));

describe("CookieConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavePreferences.mockResolvedValue(undefined);
    // Reset mock implementation
    mockUseCookieConsent.mockReset();
    mockToast.error.mockReset();
    mockToast.success.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("should not render when consent exists", () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: true,
        consent: {
          essential: true,
          preferences: true,
          analytics: false,
          marketing: false,
        },
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    const { container } = render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
  });

  it("should render when no consent exists", async () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: false,
        consent: null,
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("should not render when loading", () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: null,
      isLoading: true,
      savePreferences: mockSavePreferences,
    });

    const { container } = render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
  });

  it("allows toggling and bulk accept/reject actions", async () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: false,
        consent: null,
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByText("Cookie Preferences");

    fireEvent.click(screen.getByLabelText("Preferences disabled"));
    expect(screen.getByLabelText("Preferences enabled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept All" }));
    expect(screen.getByLabelText("Analytics enabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Marketing enabled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject All" }));
    expect(screen.getByLabelText("Preferences disabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Analytics disabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Marketing disabled")).toBeInTheDocument();
  });

  it("saves preferences with current selections", async () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: false,
        consent: null,
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByText("Cookie Preferences");
    fireEvent.click(screen.getByRole("button", { name: "Accept All" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith({
        essential: true,
        preferences: true,
        analytics: true,
        marketing: true,
      }),
    );
  });

  it("shows an error when saving preferences fails", async () => {
    mockSavePreferences.mockRejectedValue(new Error("Save failed"));
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: false,
        consent: null,
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByText("Cookie Preferences");
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Failed to save preferences"));
  });

  it("prevents toggling essential cookies", async () => {
    mockUseCookieConsent.mockReturnValue({
      consentStatus: {
        hasConsent: false,
        consent: null,
      },
      isLoading: false,
      savePreferences: mockSavePreferences,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <CookieConsent />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByText("Cookie Preferences");
    const essentialToggle = screen.getByLabelText("Essential Cookies enabled");
    fireEvent.click(essentialToggle);
    expect(screen.getByLabelText("Essential Cookies enabled")).toBeInTheDocument();
  });
});
