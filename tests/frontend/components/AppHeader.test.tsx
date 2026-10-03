import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppHeader from "../../src/components/AppHeader";
import { useThemeStore } from "../../src/store/theme.store";

vi.mock("../../src/components/BrandLogo", () => ({
  default: () => <img alt="FitVibe" />,
}));

vi.mock("../../src/components/ThemeToggle", () => ({
  default: ({ variant }: { variant?: string }) => (
    <button type="button" data-testid="theme-toggle" data-variant={variant}>
      Theme
    </button>
  ),
}));

vi.mock("../../src/components/LanguageSwitcher", () => ({
  default: ({ variant }: { variant?: string }) => (
    <button type="button" data-testid="language-switcher" data-variant={variant}>
      Language
    </button>
  ),
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
        "navigation.signOut": "Logout",
        "brand.slogan": "Balance is not a state",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("AppHeader", () => {
  it("renders the writing/light variation with active and disabled navigation states", () => {
    act(() => {
      useThemeStore.setState({ theme: "light" });
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppHeader variant="writing" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "writing");
    expect(header).toHaveAttribute("data-theme", "light");
    expect(screen.getByText("Balance is not a state")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the standard/dark variation as an icon-oriented shell", () => {
    act(() => {
      useThemeStore.setState({ theme: "dark" });
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppHeader variant="standard" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "standard");
    expect(header).toHaveAttribute("data-theme", "dark");
    expect(screen.queryByText("Balance is not a state")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toHaveAttribute("data-variant", "header");
    expect(screen.getByTestId("language-switcher")).toHaveAttribute("data-variant", "header");
  });

  it("activates a navigation destination when its page is available", () => {
    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <AppHeader
          variant="writing"
          availablePaths={["/", "/calendar"]}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("delegates logout and prevents duplicate submissions while it is pending", async () => {
    let resolveSignOut: (() => void) | undefined;
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <AppHeader variant="writing" onSignOut={onSignOut} />
      </MemoryRouter>,
    );

    const logout = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logout);
    fireEvent.click(logout);

    expect(onSignOut).toHaveBeenCalledTimes(1);

    act(() => {
      resolveSignOut?.();
    });

    await waitFor(() => expect(logout).not.toBeDisabled());
  });
});
