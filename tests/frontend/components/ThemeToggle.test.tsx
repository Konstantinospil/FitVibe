import React from "react";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "../../src/components/ThemeToggle";
import { useThemeStore } from "../../src/store/theme.store";

vi.mock("../../src/store/theme.store");

describe("ThemeToggle", () => {
  const mockToggleTheme = vi.fn();
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "dark" as const,
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should render theme toggle button", () => {
    const { container } = render(<ThemeToggle />);
    const buttons = screen.getAllByRole("button");
    const button = Array.from(buttons).find((btn) => container.contains(btn)) || buttons[0];
    expect(button).toBeInTheDocument();
  });

  it("should expose the switch-to-light action when theme is dark", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "dark" as const,
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    const { container } = render(<ThemeToggle />);
    const buttons = screen.getAllByRole("button");
    const button = Array.from(buttons).find((btn) => container.contains(btn)) || buttons[0];
    expect(button).toHaveAttribute("aria-label", "Switch to light mode");
    expect(button).toHaveAttribute("title", "Switch to light mode");
  });

  it("should expose the switch-to-dark action when theme is light", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      theme: "light" as const,
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    const { container } = render(<ThemeToggle />);
    const buttons = screen.getAllByRole("button");
    const button = Array.from(buttons).find((btn) => container.contains(btn)) || buttons[0];
    expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
    expect(button).toHaveAttribute("title", "Switch to dark mode");
  });

  it("should call toggleTheme when clicked", () => {
    const { container } = render(<ThemeToggle />);

    const buttons = screen.getAllByRole("button");
    const button = Array.from(buttons).find((btn) => container.contains(btn)) || buttons[0];
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("should have accessible button with proper ARIA attributes", () => {
    const { container } = render(<ThemeToggle />);
    const buttons = screen.getAllByRole("button");
    const button = Array.from(buttons).find((btn) => container.contains(btn)) || buttons[0];
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-label");
    expect(button).toHaveAttribute("title");
  });
});
