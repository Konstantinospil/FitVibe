import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Label } from "../../src/components/ui/Label";

describe("Label", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render label element", () => {
      render(<Label>Email</Label>);
      const label = screen.getByText("Email");
      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe("LABEL");
    });

    it("should render children", () => {
      render(<Label>Test Label</Label>);
      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("should render with custom id", () => {
      render(<Label id="custom-label">Email</Label>);
      const label = screen.getByText("Email");
      expect(label).toHaveAttribute("id", "custom-label");
    });

    it("should render with htmlFor attribute", () => {
      render(<Label htmlFor="email-input">Email</Label>);
      const label = screen.getByText("Email");
      expect(label).toHaveAttribute("for", "email-input");
    });
  });

  describe("Required indicator", () => {
    it("should show required indicator when required is true", () => {
      render(<Label required>Email</Label>);
      const label = screen.getByText("Email");
      const requiredIndicator = label.querySelector("span");
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveTextContent("*");
    });

    it("should not show required indicator when required is false", () => {
      render(<Label required={false}>Email</Label>);
      const label = screen.getByText("Email");
      const requiredIndicator = label.querySelector("span");
      expect(requiredIndicator).not.toBeInTheDocument();
    });

    it("should not show required indicator by default", () => {
      render(<Label>Email</Label>);
      const label = screen.getByText("Email");
      const requiredIndicator = label.querySelector("span");
      expect(requiredIndicator).not.toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should apply error color when error is true", () => {
      const { container } = render(<Label error>Email</Label>);
      const label = container.querySelector("label");
      expect(label).toHaveStyle({
        color: "var(--color-danger-text)",
      });
    });

    it("should not apply error color when error is false", () => {
      const { container } = render(<Label error={false}>Email</Label>);
      const label = container.querySelector("label");
      expect(label).toHaveStyle({
        color: "var(--color-text-primary)",
      });
    });

    it("should not apply error color by default", () => {
      const { container } = render(<Label>Email</Label>);
      const label = container.querySelector("label");
      expect(label).toHaveStyle({
        color: "var(--color-text-primary)",
      });
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      render(<Label className="custom-class">Email</Label>);
      const label = screen.getByText("Email");
      expect(label).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(<Label style={{ marginTop: "10px" }}>Email</Label>);
      const label = container.querySelector("label");
      expect(label).toHaveStyle({ marginTop: "10px" });
    });

    it("should merge custom style with default styles", () => {
      const { container } = render(<Label style={{ fontSize: "16px" }}>Email</Label>);
      const label = container.querySelector("label");
      expect(label).toHaveStyle({
        fontSize: "16px",
        fontWeight: "500",
      });
    });
  });

  describe("Props forwarding", () => {
    it("should forward standard label attributes", () => {
      render(
        <Label htmlFor="input" id="label-id" className="test-class" data-testid="test-label">
          Email
        </Label>,
      );
      const label = screen.getByTestId("test-label");
      expect(label).toHaveAttribute("for", "input");
      expect(label).toHaveAttribute("id", "label-id");
      expect(label).toHaveClass("test-class");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty children", () => {
      const { container } = render(<Label>{""}</Label>);
      const label = container.querySelector("label");
      expect(label).toBeInTheDocument();
    });

    it("should handle required and error together", () => {
      render(
        <Label required error>
          Email
        </Label>,
      );
      const label = screen.getByText("Email");
      expect(label).toBeInTheDocument();
      const requiredIndicator = label.querySelector("span");
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveTextContent("*");
    });

    it("should handle complex children", () => {
      render(
        <Label>
          Email <span data-testid="helper">(required)</span>
        </Label>,
      );
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByTestId("helper")).toBeInTheDocument();
    });
  });
});
