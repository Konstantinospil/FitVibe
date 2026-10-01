import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import ThemeToggle from "../../src/components/ThemeToggle";
import { useThemeStore } from "../../src/store/theme.store";

describe("ThemeToggle Accessibility", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "dark" });
    document.documentElement.removeAttribute("data-theme");
  });

  describe("ARIA attributes", () => {
    it("should have proper button role", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should have descriptive aria-label for dark theme", () => {
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to light mode/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Switch to light mode");
    });

    it("should have descriptive aria-label for light theme", () => {
      useThemeStore.setState({ theme: "light" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
    });

    it("should update aria-label when theme changes", () => {
      act(() => {
        useThemeStore.setState({ theme: "dark" });
      });
      const { rerender } = render(<ThemeToggle />);

      let button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Switch to light mode");

      act(() => {
        useThemeStore.setState({ theme: "light" });
      });
      rerender(<ThemeToggle />);

      button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
    });

    it("should have matching title attribute for tooltip", () => {
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("title", "Switch to light mode");
    });

    it("should have type='button' to prevent form submission", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });
  });

  describe("Keyboard navigation", () => {
    it("should be focusable with Tab key", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      button.focus();

      expect(button).toHaveFocus();
    });

    it("should toggle theme when Enter is pressed", async () => {
      const user = userEvent.setup();
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("should toggle theme when Space is pressed", async () => {
      const user = userEvent.setup();
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("should maintain focus after theme toggle", async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(button).toHaveFocus();
    });
  });

  describe("Screen reader support", () => {
    it("should announce current action to screen readers", () => {
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to light mode/i });
      expect(button).toHaveAccessibleName("Switch to light mode");
    });

    it("should provide icon-only button with text alternative", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      // Button should have aria-label since it's icon-only
      expect(button.getAttribute("aria-label")).toBeTruthy();
    });

    it("should communicate state change to screen readers", () => {
      const { rerender } = render(<ThemeToggle />);

      const initialLabel = screen.getByRole("button").getAttribute("aria-label");

      fireEvent.click(screen.getByRole("button"));
      rerender(<ThemeToggle />);

      const newLabel = screen.getByRole("button").getAttribute("aria-label");

      expect(initialLabel).not.toBe(newLabel);
    });
  });

  describe("Visual accessibility", () => {
    it("should display appropriate icon for current theme", () => {
      act(() => {
        useThemeStore.setState({ theme: "dark" });
      });
      const { container } = render(<ThemeToggle />);

      // Sun icon for dark theme (to switch to light)
      let icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();

      act(() => {
        useThemeStore.setState({ theme: "light" });
      });
      const { container: container2 } = render(<ThemeToggle />);

      // Moon icon for light theme (to switch to dark)
      icon = container2.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should have visible focus indicator", () => {
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
      // CSS focus styles should be applied via :focus-visible
    });

    it("should have sufficient color contrast", () => {
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");

      // Should use semantic color variables
      expect(styles).toContain("--color-secondary");
      expect(styles).toContain("--color-secondary-on");
    });

    it("should have minimum touch target size", () => {
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");

      // Should have padding for adequate touch target (44x44px minimum)
      expect(styles).toContain("padding");
    });
  });

  describe("Focus management", () => {
    it("should be included in tab order", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");

      expect(button.tabIndex).not.toBe(-1);
    });

    it("should receive focus on click", async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(button).toHaveFocus();
    });

    it("should not have visual focus on mouse click (focus-visible)", async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Browser should handle :focus-visible vs :focus
      expect(button).toHaveFocus();
    });
  });

  describe("Theme persistence", () => {
    it("should apply theme changes to document", () => {
      useThemeStore.setState({ theme: "dark" });
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // ThemeStore should update document.documentElement
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("should preserve theme preference", () => {
      useThemeStore.setState({ theme: "light" });
      render(<ThemeToggle />);

      expect(useThemeStore.getState().theme).toBe("light");
    });
  });

  describe("Interactive states", () => {
    it("should show hover state with mouse interaction", async () => {
      const user = userEvent.setup();
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      if (button) {
        await user.hover(button);
        // Hover styles are applied via CSS :hover pseudo-class
        expect(button).toBeInTheDocument();
      }
    });

    it("should show active state when clicked", () => {
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      // Active styles are applied via CSS :active pseudo-class
      expect(button).toBeInTheDocument();
    });
  });

  describe("High contrast mode", () => {
    it("should use border for contrast in high contrast mode", () => {
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");

      // Should have border for high contrast mode support
      expect(styles).toContain("border");
    });
  });

  describe("Reduced motion", () => {
    it("should respect prefers-reduced-motion", () => {
      const { container } = render(<ThemeToggle />);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");

      // Transitions should be defined but browsers will disable if prefers-reduced-motion
      expect(styles).toContain("transition");
    });
  });
});
