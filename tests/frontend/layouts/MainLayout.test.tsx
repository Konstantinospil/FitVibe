import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MainLayout from "../../src/layouts/MainLayout";
import { useAuth } from "../../src/contexts/AuthContext";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "navigation.home": "Home",
        "navigation.calendar": "Calendar",
        "navigation.library": "Library",
        "navigation.dashboard": "Dashboard",
        "navigation.settings": "Settings",
        "navigation.skipToContent": "Skip to content",
        "navigation.signOut": "Sign out",
        "brand.logoAlt": "FitVibe",
        "brand.slogan": "Balance is not a state",
        "footer.note": "FitVibe",
        "footer.terms": "Terms",
        "footer.privacy": "Privacy",
        "language.label": "Language",
        "language.select": "Select language",
        "language.english": "English",
        "language.german": "German",
        "language.french": "French",
        "language.spanish": "Spanish",
        "language.greek": "Greek",
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      signIn: vi.fn(),
      signOut: mockSignOut,
      user: null,
      isAuthenticated: false,
      updateUser: vi.fn(),
    });
  });

  it("renders the canonical application navigation contract", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders the skip-to-content link", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Skip to content")).toHaveAttribute("href", "#main-content");
  });

  it("handles sign out and returns to login", async () => {
    mockSignOut.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("renders footer links and the child outlet target", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(document.querySelector("#main-content")).toBeInTheDocument();
  });

  it("renders the branded header utilities", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getAllByAltText("FitVibe").length).toBeGreaterThan(0);
    expect(screen.getByText("Balance is not a state")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
  });

  it("marks Home as the current page", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });
});
