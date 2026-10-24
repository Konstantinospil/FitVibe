import React from "react";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AuthPageLayout from "../../src/components/AuthPageLayout";
import { useThemeStore } from "../../src/store/theme.store";

vi.mock("../../src/i18n/config", () => ({
  loadLanguageTranslations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "footer.terms": "Terms",
        "footer.privacy": "Privacy",
        "brand.logoAlt": "FitVibe",
        "footer.expand": "Expand footer",
        "footer.collapse": "Collapse footer",
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
    },
  }),
}));

vi.mock("../../src/utils/idleScheduler", () => ({
  scheduleIdleTask: (cb: () => void) => {
    cb();
    return { cancel: vi.fn() };
  },
}));

describe("AuthPageLayout", () => {
  afterEach(() => {
    cleanup();
    useThemeStore.setState({ theme: "dark" });
  });

  it("should render with title and description", () => {
    render(
      <MemoryRouter>
        <AuthPageLayout title="Test Title" description="Test Description">
          <div>Test Content</div>
        </AuthPageLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    // The global PageShell starts with the footer collapsed so it does not
    // consume the small-screen authentication viewport. Hidden artwork must
    // remain mounted and be available when the user expands the footer.
    const primaryLogo = screen.getByRole("img", { name: "FitVibe" });
    expect(primaryLogo).toHaveAttribute("fetchpriority", "high");
    expect(primaryLogo).toHaveAttribute("loading", "eager");
    const footer = screen.getByRole("contentinfo", { hidden: true });
    expect(footer.closest('[data-slot="footer-collapsible"]')).toHaveAttribute("hidden");
    const footerLogo = Array.from(footer.querySelectorAll('img')).find(
      (image) => image.getAttribute("alt") === "FitVibe",
    );
    expect(footerLogo).toBeDefined();
    expect(footerLogo).toHaveAttribute("loading", "lazy");
    fireEvent.click(screen.getByRole("button", { name: "Expand footer" }));
    expect(footer.closest('[data-slot="footer-collapsible"]')).not.toHaveAttribute("hidden");
    expect(screen.getAllByRole("img", { name: "FitVibe" })).toHaveLength(2);
  });

  it("should switch brand artwork when the application theme changes", () => {
    useThemeStore.setState({ theme: "dark" });

    render(
      <MemoryRouter>
        <AuthPageLayout title="Test Title" description="Test Description">
          <div>Content</div>
        </AuthPageLayout>
      </MemoryRouter>,
    );

    const logo = screen.getAllByRole("img", { name: "FitVibe" })[0];
    const darkSource = logo.getAttribute("src");

    act(() => {
      useThemeStore.setState({ theme: "light" });
    });

    expect(logo.getAttribute("src")).not.toBe(darkSource);
  });

  it("should render footer links", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthPageLayout title="Test Title" description="Test Description">
          <div>Content</div>
        </AuthPageLayout>
      </MemoryRouter>,
    );

    const termsTexts = screen.getAllByText("Terms");
    const privacyTexts = screen.getAllByText("Privacy");
    const terms = Array.from(termsTexts).find((el) => container.contains(el)) || termsTexts[0];
    const privacy =
      Array.from(privacyTexts).find((el) => container.contains(el)) || privacyTexts[0];
    expect(terms).toBeInTheDocument();
    expect(privacy).toBeInTheDocument();
  });

  it("should render the semantic public header and utilities after the idle task", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthPageLayout title="Test Title" description="Test Description">
          <div>Content</div>
        </AuthPageLayout>
      </MemoryRouter>,
    );

    const header = container.querySelector<HTMLElement>('header[data-component="public-header"]');
    expect(header).toBeInTheDocument();
    expect(header?.querySelector(".public-header__utilities")).toBeInTheDocument();
  });
});
