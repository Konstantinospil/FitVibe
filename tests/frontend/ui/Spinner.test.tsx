import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Spinner } from "../../src/components/ui/Spinner";

describe("Spinner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render spinner element", () => {
      render(<Spinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toBeInTheDocument();
    });

    it("should have default aria-label", () => {
      render(<Spinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveAttribute("aria-label", "Loading");
    });

    it("should use custom aria-label when provided", () => {
      render(<Spinner aria-label="Processing" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveAttribute("aria-label", "Processing");
    });

    it("should expose a visible label to assistive technology and render its sr-only text", () => {
      render(<Spinner label="Saving changes" />);
      const spinner = screen.getByRole("status", { name: "Saving changes" });
      expect(spinner).toHaveAttribute("aria-label", "Saving changes");
      expect(screen.getByText("Saving changes")).toHaveClass("sr-only");
    });
  });

  describe("Size variants", () => {
    it("should apply sm size styles", () => {
      const { container } = render(<Spinner size="sm" />);
      const spinner = container.querySelector('[role="status"]');
      expect((spinner as HTMLElement).style.width).toBe("1rem");
      expect((spinner as HTMLElement).style.height).toBe("1rem");
      expect((spinner as HTMLElement).style.borderWidth).toBe("2px");
    });

    it("should apply md size styles (default)", () => {
      const { container } = render(<Spinner size="md" />);
      const spinner = container.querySelector('[role="status"]');
      expect((spinner as HTMLElement).style.width).toBe("1.5rem");
      expect((spinner as HTMLElement).style.height).toBe("1.5rem");
      expect((spinner as HTMLElement).style.borderWidth).toBe("3px");
    });

    it("should apply lg size styles", () => {
      const { container } = render(<Spinner size="lg" />);
      const spinner = container.querySelector('[role="status"]');
      expect((spinner as HTMLElement).style.width).toBe("2rem");
      expect((spinner as HTMLElement).style.height).toBe("2rem");
      expect((spinner as HTMLElement).style.borderWidth).toBe("4px");
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      render(<Spinner className="custom-class" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(<Spinner style={{ marginTop: "10px" }} />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveStyle({ marginTop: "10px" });
    });

    it("should merge custom style with default styles", () => {
      const { container } = render(<Spinner style={{ width: "3rem" }} />);
      const spinner = container.querySelector('[role="status"]');
      expect((spinner as HTMLElement).style.width).toBe("3rem");
      expect((spinner as HTMLElement).style.display).toBe("inline-block");
    });
  });

  describe("Accessibility", () => {
    it("should have role status", () => {
      render(<Spinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toBeInTheDocument();
    });

    it("should have aria-label for screen readers", () => {
      render(<Spinner />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveAttribute("aria-label");
    });

    it("should include animation styles", () => {
      render(<Spinner />);
      const styleElement = document.head.querySelector("style[data-spinner-keyframes]");
      expect(styleElement).toBeInTheDocument();
      expect(styleElement?.textContent).toContain("@keyframes spinner-rotate");
    });

    it("should respect prefers-reduced-motion", () => {
      render(<Spinner />);
      const styleElement = document.head.querySelector("style[data-spinner-keyframes]");
      expect(styleElement?.textContent).toContain("prefers-reduced-motion");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty aria-label", () => {
      render(<Spinner aria-label="" />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveAttribute("aria-label", "");
    });

    it("should handle very long aria-label", () => {
      const longLabel = "a".repeat(200);
      render(<Spinner aria-label={longLabel} />);
      const spinner = screen.getByRole("status");
      expect(spinner).toHaveAttribute("aria-label", longLabel);
    });
  });
});
