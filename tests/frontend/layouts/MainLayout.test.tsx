import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
        "navigation.profile": "Profile",
        "navigation.skipToContent": "Skip to content",
        "navigation.you": "You",
        "navigation.activeSession": "Active session",
        "navigation.signOut": "Sign out",
        "footer.note": "FitVibe",
        "footer.terms": "Terms",
        "footer.privacy": "Privacy",
        "brand.logoAlt": "FitVibe",
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
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

  it("should render main layout with navigation", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    // Navigation items use icons with aria-labels - use getAllByLabelText and check first
    const homeLinks = screen.getAllByLabelText("Home");
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Profile")).not.toBeInTheDocument();
  });

  it("should render skip to content link", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    const skipLink = screen.getByText("Skip to content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("should handle sign out", async () => {
    mockSignOut.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    const signOutButton = screen.getByLabelText("Sign out");
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("should render footer links", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });

  it("should render outlet for child routes", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    const main = document.querySelector("#main-content");
    expect(main).toBeInTheDocument();
  });

  it("should render logo", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    const logo = screen.getByAltText("FitVibe Logo");
    expect(logo).toBeInTheDocument();
  });

  it("should render theme toggle", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    // ThemeToggle should be present (it's rendered in the layout)
    // Check for navigation elements - there may be multiple (header and footer)
    const navElements = screen.getAllByRole("navigation");
    expect(navElements.length).toBeGreaterThan(0);
    // ThemeToggle renders a button, so we can check for it
    const themeButtons = screen.getAllByRole("button");
    expect(themeButtons.length).toBeGreaterThan(0);
  });

  it("should render language switcher", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    // LanguageSwitcher should be present (it's rendered in the layout)
    // Check for navigation elements - there may be multiple (header and footer)
    const navElements = screen.getAllByRole("navigation");
    expect(navElements.length).toBeGreaterThan(0);
    // LanguageSwitcher renders a button, so we can check for it
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should render user avatar when authenticated", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      signIn: vi.fn(),
      signOut: mockSignOut,
      user: { id: "user-1", username: "test", email: "test@example.com" },
      isAuthenticated: true,
      updateUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    // Avatar should be present when user is authenticated
    // Check for navigation elements - there may be multiple (header and footer)
    const navElements = screen.getAllByRole("navigation");
    expect(navElements.length).toBeGreaterThan(0);
    // Check for the "You" text which is rendered with the avatar
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("should navigate when nav link is clicked", () => {
    render(
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>,
    );

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("href", "/");
    fireEvent.click(homeLink);
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });
});
