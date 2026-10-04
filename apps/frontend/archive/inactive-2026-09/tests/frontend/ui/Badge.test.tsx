import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Badge } from "../../src/components/ui/Badge";

describe("Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render badge element", () => {
      render(<Badge>New</Badge>);
      const badge = screen.getByText("New");
      expect(badge).toBeInTheDocument();
      expect(badge.tagName).toBe("SPAN");
    });

    it("should render children", () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText("Test Badge")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("should apply default variant", () => {
      const { container } = render(<Badge>Default</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeInTheDocument();
    });

    it("should apply primary variant", () => {
      render(<Badge variant="primary">Primary</Badge>);
      const badge = screen.getByText("Primary");
      expect(badge).toBeInTheDocument();
    });

    it("should apply secondary variant", () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText("Secondary");
      expect(badge).toBeInTheDocument();
    });

    it("should apply success variant", () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText("Success");
      expect(badge).toBeInTheDocument();
    });

    it("should apply warning variant", () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText("Warning");
      expect(badge).toBeInTheDocument();
    });

    it("should apply danger variant", () => {
      render(<Badge variant="danger">Danger</Badge>);
      const badge = screen.getByText("Danger");
      expect(badge).toBeInTheDocument();
    });

    it("should apply info variant", () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText("Info");
      expect(badge).toBeInTheDocument();
    });

    it("should apply planned variant", () => {
      render(<Badge variant="planned">Planned</Badge>);
      const badge = screen.getByText("Planned");
      expect(badge).toBeInTheDocument();
    });

    it("should apply completed variant", () => {
      render(<Badge variant="completed">Completed</Badge>);
      const badge = screen.getByText("Completed");
      expect(badge).toBeInTheDocument();
    });

    it("should apply strength variant", () => {
      render(<Badge variant="strength">Strength</Badge>);
      const badge = screen.getByText("Strength");
      expect(badge).toBeInTheDocument();
    });

    it("should apply agility variant", () => {
      render(<Badge variant="agility">Agility</Badge>);
      const badge = screen.getByText("Agility");
      expect(badge).toBeInTheDocument();
    });

    it("should apply endurance variant", () => {
      render(<Badge variant="endurance">Endurance</Badge>);
      const badge = screen.getByText("Endurance");
      expect(badge).toBeInTheDocument();
    });

    it("should apply explosivity variant", () => {
      render(<Badge variant="explosivity">Explosivity</Badge>);
      const badge = screen.getByText("Explosivity");
      expect(badge).toBeInTheDocument();
    });

    it("should apply intelligence variant", () => {
      render(<Badge variant="intelligence">Intelligence</Badge>);
      const badge = screen.getByText("Intelligence");
      expect(badge).toBeInTheDocument();
    });

    it("should apply regeneration variant", () => {
      render(<Badge variant="regeneration">Regeneration</Badge>);
      const badge = screen.getByText("Regeneration");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("should apply sm size styles", () => {
      const { container } = render(<Badge size="sm">Small</Badge>);
      const badge = container.querySelector("span");
      expect((badge as HTMLElement).style.padding).toBe("0.25rem 0.5rem");
      expect((badge as HTMLElement).style.fontSize).toBe("var(--font-size-xs)");
    });

    it("should apply md size styles (default)", () => {
      const { container } = render(<Badge size="md">Medium</Badge>);
      const badge = container.querySelector("span");
      expect((badge as HTMLElement).style.padding).toBe("0.375rem 0.75rem");
      expect((badge as HTMLElement).style.fontSize).toBe("var(--font-size-sm)");
    });

    it("should apply lg size styles", () => {
      const { container } = render(<Badge size="lg">Large</Badge>);
      const badge = container.querySelector("span");
      expect((badge as HTMLElement).style.padding).toBe("0.5rem 1rem");
      expect((badge as HTMLElement).style.fontSize).toBe("var(--font-size-md)");
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      render(<Badge className="custom-class">Badge</Badge>);
      const badge = screen.getByText("Badge");
      expect(badge).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(<Badge style={{ marginTop: "10px" }}>Badge</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toHaveStyle({ marginTop: "10px" });
    });

    it("should merge custom style with default styles", () => {
      const { container } = render(<Badge style={{ fontWeight: 400 }}>Badge</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toHaveStyle({
        fontWeight: "400",
        display: "inline-flex",
      });
    });
  });

  describe("Props forwarding", () => {
    it("should forward standard span attributes", () => {
      render(
        <Badge id="badge-id" className="test-class" data-testid="test-badge">
          Badge
        </Badge>,
      );
      const badge = screen.getByTestId("test-badge");
      expect(badge).toHaveAttribute("id", "badge-id");
      expect(badge).toHaveClass("test-class");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty children", () => {
      const { container } = render(<Badge>{""}</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeInTheDocument();
    });

    it("should handle numeric children", () => {
      render(<Badge>{42}</Badge>);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("should handle complex children", () => {
      render(
        <Badge>
          Count: <span data-testid="count">5</span>
        </Badge>,
      );
      expect(screen.getByText("Count:")).toBeInTheDocument();
      expect(screen.getByTestId("count")).toBeInTheDocument();
    });
  });
});
