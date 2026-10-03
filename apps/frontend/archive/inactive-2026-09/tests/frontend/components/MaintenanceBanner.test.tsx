import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import MaintenanceBanner from "../../src/components/MaintenanceBanner";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Mock feature flags hook
vi.mock("../../src/utils/featureFlags", () => ({
  useReadOnlyMode: vi.fn(),
}));

import { useReadOnlyMode } from "../../src/utils/featureFlags";

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "components.maintenanceBanner.message": "System is currently in maintenance mode",
      },
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={testI18n}>{component}</I18nextProvider>);
};

describe("MaintenanceBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when read-only mode is disabled", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: false,
      message: undefined,
    });

    const { container } = renderWithProviders(<MaintenanceBanner />);

    expect(container.firstChild).toBeNull();
  });

  it("renders banner when read-only mode is enabled", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: true,
      message: "System maintenance in progress",
    });

    const { container } = renderWithProviders(<MaintenanceBanner />);

    const alerts = screen.getAllByRole("alert");
    const alert = Array.from(alerts).find((el) => container.contains(el)) || alerts[0];
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("System maintenance in progress")).toBeInTheDocument();
  });

  it("displays custom message from read-only mode config", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: true,
      message: "Emergency maintenance - back online at 15:00 UTC",
    });

    renderWithProviders(<MaintenanceBanner />);

    expect(
      screen.getByText("Emergency maintenance - back online at 15:00 UTC"),
    ).toBeInTheDocument();
  });

  it("falls back to translation key when no custom message provided", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: true,
      message: undefined,
    });

    renderWithProviders(<MaintenanceBanner />);

    expect(screen.getByText("System is currently in maintenance mode")).toBeInTheDocument();
  });

  it("has correct ARIA attributes for accessibility", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: true,
      message: "Maintenance in progress",
    });

    const { container } = renderWithProviders(<MaintenanceBanner />);

    const alerts = screen.getAllByRole("alert");
    const banner = Array.from(alerts).find((el) => container.contains(el)) || alerts[0];
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("displays maintenance emoji icon", () => {
    vi.mocked(useReadOnlyMode).mockReturnValue({
      readOnlyMode: true,
      message: "Maintenance",
    });

    const { container } = renderWithProviders(<MaintenanceBanner />);

    const alerts = screen.getAllByRole("alert");
    const banner = Array.from(alerts).find((el) => container.contains(el)) || alerts[0];
    expect(banner.textContent).toContain("🛠️");
  });
});
