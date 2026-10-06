import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PageIntro from "../../src/components/PageIntro";

describe("PageIntro Accessibility", () => {
  const defaultProps = {
    eyebrow: "Welcome",
    title: "Getting Started with FitVibe",
    description: "Track your workouts, monitor your progress, and achieve your fitness goals.",
  };

  afterEach(() => {
    cleanup();
  });

  describe("semantic structure", () => {
    it("uses a section and article for page-intro grouping", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      expect(container.querySelector("section[data-component='page-intro']")).toBeInTheDocument();
      expect(container.querySelector("article[data-slot='page-intro-card']")).toBeInTheDocument();
    });

    it("renders the title as a heading", () => {
      render(<PageIntro {...defaultProps} />);

      expect(
        screen.getByRole("heading", { name: "Getting Started with FitVibe" }),
      ).toBeVisible();
    });

    it("exposes stable semantic slots for descriptive content", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      expect(container.querySelector("[data-slot='page-intro-eyebrow-text']")).toHaveTextContent(
        "Welcome",
      );
      expect(container.querySelector("[data-slot='page-intro-title']")).toHaveTextContent(
        "Getting Started with FitVibe",
      );
      expect(container.querySelector("[data-slot='page-intro-description']")).toHaveTextContent(
        "Track your workouts",
      );
    });

    it("keeps the decorative accent hidden from assistive technology", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const accent = container.querySelector("[data-slot='page-intro-accent']");
      expect(accent).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("reading order", () => {
    it("places eyebrow, title, and description in natural DOM order", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const eyebrow = container.querySelector("[data-slot='page-intro-eyebrow']");
      const title = container.querySelector("[data-slot='page-intro-title']");
      const description = container.querySelector("[data-slot='page-intro-description']");

      expect(eyebrow).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(eyebrow?.compareDocumentPosition(title as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        title?.compareDocumentPosition(description as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("keeps child content outside the heading group", () => {
      const { container } = render(
        <PageIntro {...defaultProps}>
          <p data-testid="child-content">Additional instructions</p>
        </PageIntro>,
      );

      const header = container.querySelector("header");
      const child = screen.getByTestId("child-content");
      expect(header).not.toContainElement(child);
      expect(child).toBeVisible();
    });

    it("places actions after the heading group", () => {
      render(
        <PageIntro
          {...defaultProps}
          actions={<button type="button">Back</button>}
        />,
      );

      const heading = screen.getByRole("heading", { name: defaultProps.title });
      const action = screen.getByRole("button", { name: "Back" });
      expect(
        heading.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("optional content", () => {
    it("renders brand content with its own accessible name", () => {
      render(
        <PageIntro
          {...defaultProps}
          brand={<img alt="FitVibe" src="/logo.png" />}
        />,
      );

      expect(screen.getByRole("img", { name: "FitVibe" })).toBeVisible();
    });

    it("omits the eyebrow structure when no eyebrow is supplied", () => {
      const { container } = render(
        <PageIntro title={defaultProps.title} description={defaultProps.description} />,
      );

      expect(container.querySelector("[data-slot='page-intro-eyebrow']")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: defaultProps.title })).toBeVisible();
    });

    it("omits child CardContent when no child content is supplied", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      expect(container.querySelector("[data-component='card-content']")).not.toBeInTheDocument();
    });

    it("marks the priority-LCP variant semantically without inline visual overrides", () => {
      const { container } = render(<PageIntro {...defaultProps} priorityLcp />);

      const article = container.querySelector("article[data-slot='page-intro-card']");
      expect(article).toHaveAttribute("data-priority-lcp", "true");
      expect(article).not.toHaveAttribute("style");
    });
  });

  describe("content robustness", () => {
    it("preserves long accessible text", () => {
      const longTitle =
        "This is a very long title that should wrap properly and remain readable";
      const longDescription =
        "This is a long description that provides extensive information while remaining available to assistive technology.";

      render(
        <PageIntro
          eyebrow="Overview"
          title={longTitle}
          description={longDescription}
        />,
      );

      expect(screen.getByRole("heading", { name: longTitle })).toBeVisible();
      expect(screen.getByText(longDescription)).toBeVisible();
    });

    it("preserves punctuation and special characters", () => {
      render(
        <PageIntro
          eyebrow="Step #1"
          title="Getting Started & Setting Up"
          description={'Track "PRs" & monitor progress—it\'s that simple!'}
        />,
      );

      expect(screen.getByText("Step #1")).toBeVisible();
      expect(screen.getByRole("heading", { name: "Getting Started & Setting Up" })).toBeVisible();
      expect(screen.getByText(/Track "PRs"/)).toBeVisible();
    });
  });

  describe("centralized visual contract", () => {
    it("exposes styling hooks instead of page-local inline aesthetics", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      expect(container.querySelector("[data-slot='page-intro-eyebrow']")).toBeInTheDocument();
      expect(container.querySelector("[data-slot='page-intro-accent']")).toBeInTheDocument();
      expect(container.querySelector("[data-slot='page-intro-title']")).toBeInTheDocument();
      expect(container.querySelector("[data-slot='page-intro-description']")).toBeInTheDocument();
    });

    it("keeps the page-intro component free of inline visual style attributes", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const root = container.querySelector("[data-component='page-intro']");
      expect(root?.querySelectorAll("[style]")).toHaveLength(0);
    });
  });
});
