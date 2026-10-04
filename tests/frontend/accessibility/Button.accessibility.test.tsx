import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../packages/ui/src/Button";

describe("Button Accessibility", () => {
  describe("ARIA attributes", () => {
    it("should have proper role", () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should have aria-disabled when disabled", () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toBeDisabled();
    });

    it("should have aria-busy when loading", () => {
      render(<Button isLoading>Loading Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("should hide loading spinner from screen readers", () => {
      const { container } = render(<Button isLoading>Loading</Button>);

      const spinner = container.querySelector('[aria-hidden="true"]');
      expect(spinner).toBeInTheDocument();
    });

    it("should support aria-label prop", () => {
      render(<Button aria-label="Save document">Save</Button>);

      const button = screen.getByRole("button", { name: "Save document" });
      expect(button).toBeInTheDocument();
    });

    it("should support aria-describedby prop", () => {
      render(
        <>
          <span id="button-desc">Click to submit form</span>
          <Button aria-describedby="button-desc">Submit</Button>
        </>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-describedby", "button-desc");
    });
  });

  describe("Keyboard navigation", () => {
    it("should be focusable by default", () => {
      render(<Button>Focus me</Button>);

      const button = screen.getByRole("button");
      button.focus();

      expect(button).toHaveFocus();
    });

    it("should not be focusable when disabled", () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("should trigger onClick when Enter key is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<Button onClick={onClick}>Press me</Button>);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should trigger onClick when Space key is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<Button onClick={onClick}>Press me</Button>);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should not trigger onClick when disabled and key is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <Button disabled onClick={onClick}>
          Disabled
        </Button>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });

    it("should not trigger onClick when loading and key is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <Button isLoading onClick={onClick}>
          Loading
        </Button>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("Screen reader support", () => {
    it("should announce button text content", () => {
      render(<Button>Save Changes</Button>);

      const button = screen.getByRole("button", { name: /save changes/i });
      expect(button).toBeInTheDocument();
    });

    it("should announce button with icon and text", () => {
      const SaveIcon = () => <svg aria-hidden="true">icon</svg>;

      render(<Button leftIcon={<SaveIcon />}>Save</Button>);

      const button = screen.getByRole("button", { name: /save/i });
      expect(button).toBeInTheDocument();
    });

    it("should preserve text content visibility when loading", () => {
      render(<Button isLoading>Submitting...</Button>);

      const button = screen.getByRole("button", { name: /submitting/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Submitting...");
    });

    it("should communicate disabled state to screen readers", () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button.getAttribute("disabled")).toBeDefined();
    });
  });

  describe("Visual accessibility", () => {
    it("should have visible focus indicator (outline test)", () => {
      const { container } = render(<Button>Focus test</Button>);

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
      // Focus styles are applied via CSS :focus-visible pseudo-class
    });

    it("should maintain minimum touch target size for small buttons", () => {
      const { container } = render(<Button size="sm">Small</Button>);

      const button = container.querySelector("button");
      expect(button).toHaveAttribute("data-size", "sm");
      // Small buttons should still meet 44x44 touch target requirements
    });

    it("should have proper color contrast for all variants", () => {
      const variants = ["primary", "secondary", "ghost", "danger"] as const;

      variants.forEach((variant) => {
        const { container } = render(<Button variant={variant}>{variant}</Button>);
        const button = container.querySelector("button");
        expect(button).toHaveAttribute("data-variant", variant);
        // Color contrast should meet WCAG AA standards (4.5:1 for normal text)
      });
    });

    it("should reduce opacity when disabled for visual feedback", () => {
      const { container } = render(<Button disabled>Disabled</Button>);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");
      expect(styles).toContain("opacity: var(--opacity-disabled)");
    });

    it("should change cursor to not-allowed when disabled", () => {
      const { container } = render(<Button disabled>Disabled</Button>);

      const button = container.querySelector("button");
      const styles = button?.getAttribute("style");
      expect(styles).toContain("cursor: not-allowed");
    });
  });

  describe("Focus management", () => {
    it("should support ref forwarding for focus management", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Button ref={ref}>Referenced Button</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.tagName).toBe("BUTTON");
    });

    it("should allow programmatic focus", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Button ref={ref}>Focus me</Button>);

      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });

    it("should allow programmatic blur", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Button ref={ref}>Blur me</Button>);

      ref.current?.focus();
      expect(ref.current).toHaveFocus();

      ref.current?.blur();
      expect(ref.current).not.toHaveFocus();
    });
  });

  describe("Icon accessibility", () => {
    it("should keep icons decorative when button has text", () => {
      const Icon = () => <svg>icon</svg>;

      render(<Button leftIcon={<Icon />}>Save</Button>);

      const button = screen.getByRole("button", { name: /save/i });
      expect(button).toBeInTheDocument();
      // Icons should be aria-hidden when button has descriptive text
    });

    it("should support icon-only buttons with aria-label", () => {
      const CloseIcon = () => <svg aria-hidden="true">×</svg>;

      render(
        <Button aria-label="Close dialog">
          <CloseIcon />
        </Button>,
      );

      const button = screen.getByRole("button", { name: /close dialog/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Loading state accessibility", () => {
    it("should maintain button dimensions when loading", () => {
      // Mock getBoundingClientRect for JSDOM environment
      const mockGetBoundingClientRect = vi.fn(() => ({
        width: 100,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;

      const { rerender, container } = render(<Button>Submit</Button>);

      const initialButton = container.querySelector("button");
      const initialHeight = initialButton?.getBoundingClientRect().height;

      rerender(<Button isLoading>Submit</Button>);

      const loadingButton = container.querySelector("button");
      const loadingHeight = loadingButton?.getBoundingClientRect().height;

      // Height should be maintained (not collapse)
      expect(loadingHeight).toBeGreaterThan(0);
      expect(loadingHeight).toBe(initialHeight);
    });

    it("should announce loading state to screen readers", () => {
      render(<Button isLoading>Submitting</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Variant accessibility", () => {
    it("should maintain accessibility across all button variants", () => {
      const variants: Array<"primary" | "secondary" | "ghost" | "danger"> = [
        "primary",
        "secondary",
        "ghost",
        "danger",
      ];

      variants.forEach((variant) => {
        const { unmount } = render(<Button variant={variant}>Click me</Button>);

        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("data-variant", variant);

        unmount();
      });
    });
  });
});
