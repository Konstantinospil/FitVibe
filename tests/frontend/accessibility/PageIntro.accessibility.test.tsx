import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
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

  describe("Semantic HTML structure", () => {
    it("should use semantic section element", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("should use article element for content", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const articles = container.querySelectorAll("article");
      expect(articles.length).toBe(1);
      expect(articles[0]).toBeInTheDocument();
    });

    it("should render eyebrow text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const welcomeElements = Array.from(container.querySelectorAll("*")).filter(
        (el) => el.textContent === "Welcome",
      );
      expect(welcomeElements.length).toBeGreaterThan(0);
    });

    it("should render title text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const titleElements = Array.from(container.querySelectorAll("*")).filter(
        (el) => el.textContent === "Getting Started with FitVibe",
      );
      expect(titleElements.length).toBeGreaterThan(0);
    });

    it("should render description text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const descriptionElements = Array.from(container.querySelectorAll("*")).filter((el) =>
        el.textContent?.includes("Track your workouts"),
      );
      expect(descriptionElements.length).toBeGreaterThan(0);
    });

    it("should render children when provided", () => {
      render(
        <PageIntro {...defaultProps}>
          <div data-testid="child-content">Additional content</div>
        </PageIntro>,
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("should not render CardContent when no children provided", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // CardContent should only render when children exist
      const cardContent = container.querySelector('[style*="padding: 0 3rem 3rem"]');
      expect(cardContent).not.toBeInTheDocument();
    });
  });

  describe("Heading hierarchy", () => {
    it("should have proper heading element for title", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // CardTitle should render as a heading (h1, h2, etc.)
      const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
      expect(heading).toBeInTheDocument();
    });

    it("should display title prominently", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Title should have large font size
      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      const styles = title?.getAttribute("style");

      expect(styles).toContain("clamp(var(--type-page-title-size), 4vw, var(--type-display-size))");
    });

    it("should maintain logical reading order", () => {
      render(
        <PageIntro {...defaultProps}>
          <p>Step-by-step instructions</p>
        </PageIntro>,
      );

      // Content should flow: eyebrow → title → description → children
      const text = document.body.textContent;
      const eyebrowIndex = text?.indexOf("Welcome") ?? -1;
      const titleIndex = text?.indexOf("Getting Started") ?? -1;
      const descIndex = text?.indexOf("Track your workouts") ?? -1;
      const childIndex = text?.indexOf("Step-by-step") ?? -1;

      expect(eyebrowIndex).toBeLessThan(titleIndex);
      expect(titleIndex).toBeLessThan(descIndex);
      expect(descIndex).toBeLessThan(childIndex);
    });
  });

  describe("Screen reader support", () => {
    it("should announce eyebrow text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has text styles, not the container)
      const eyebrow = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("text-transform: uppercase"),
      );
      expect(eyebrow).toBeDefined();
      expect(eyebrow).toBeVisible();
    });

    it("should announce title prominently", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const title = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
        (el) => el.textContent === "Getting Started with FitVibe",
      );
      expect(title).toBeDefined();
      expect(title).toBeVisible();
    });

    it("should announce description text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const description = Array.from(container.querySelectorAll("p")).find((el) =>
        el.textContent?.includes("Track your workouts"),
      );
      expect(description).toBeDefined();
      expect(description).toBeVisible();
    });

    it("should use article role for semantic grouping", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
    });

    it("should maintain text content in natural reading flow", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
      const textContent = article?.textContent;

      // Text should flow naturally for screen readers
      expect(textContent).toContain("Welcome");
      expect(textContent).toContain("Getting Started with FitVibe");
      expect(textContent).toContain("Track your workouts");
    });

    it("should announce child content when present", () => {
      render(
        <PageIntro {...defaultProps}>
          <p>Additional instructions for new users</p>
        </PageIntro>,
      );

      expect(screen.getByText("Additional instructions for new users")).toBeVisible();
    });
  });

  describe("Visual accessibility", () => {
    it("should use semantic color variables for eyebrow", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has color style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("--color-text-secondary"),
      );
      expect(eyebrowText).toBeDefined();
      const styles = eyebrowText?.getAttribute("style");

      expect(styles).toContain("--color-text-secondary");
    });

    it("should use semantic color variable for accent line", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow container span, then find the accent line within it
      const eyebrowContainer = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.getAttribute("style")?.includes("display: inline-flex") &&
          el.textContent?.includes("Welcome"),
      );
      expect(eyebrowContainer).toBeDefined();
      const accentLine = eyebrowContainer?.querySelector('[aria-hidden="true"]');
      const styles = accentLine?.getAttribute("style");

      expect(styles).toContain("--color-accent");
    });

    it("should have sufficient color contrast for text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Eyebrow uses secondary text color - find the text span, not the container
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("--color-text-secondary"),
      );
      expect(eyebrowText).toBeDefined();
      expect(eyebrowText?.getAttribute("style")).toContain("--color-text-secondary");

      // Title and description inherit color variables from Card components
      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      expect(title).toBeVisible();
    });

    it("should have proper visual hierarchy through font sizes", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has font-size style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" && el.getAttribute("style")?.includes("font-size: var(--type-supporting-size)"),
      );
      expect(eyebrowText).toBeDefined();
      const eyebrowStyles = eyebrowText?.getAttribute("style");

      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      const titleStyles = title?.getAttribute("style");

      const description = container.querySelector("p");
      const descriptionStyles = description?.getAttribute("style");

      // Eyebrow should be small
      expect(eyebrowStyles).toContain("font-size: var(--type-supporting-size)");

      // Title should be large and responsive
      expect(titleStyles).toContain("clamp(var(--type-page-title-size), 4vw, var(--type-display-size))");

      // Description should be standard size
      expect(descriptionStyles).toContain("font-size: var(--type-body-size)");
    });

    it("should have adequate line height for readability", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      const titleStyles = title?.getAttribute("style");

      const description = container.querySelector("p");
      const descriptionStyles = description?.getAttribute("style");

      expect(titleStyles).toContain("line-height: var(--type-page-title-line-height)");
      expect(descriptionStyles).toContain("line-height: var(--type-body-line-height)");
    });

    it("should use proper letter spacing for readability", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has letter-spacing style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("letter-spacing: var(--type-metric-small-letter-spacing)"),
      );
      expect(eyebrowText).toBeDefined();
      const eyebrowStyles = eyebrowText?.getAttribute("style");

      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      const titleStyles = title?.getAttribute("style");

      // Eyebrow has wider spacing for uppercase
      expect(eyebrowStyles).toContain("letter-spacing: var(--type-metric-small-letter-spacing)");

      // Title has tight spacing for large text
      expect(titleStyles).toContain("letter-spacing: var(--type-page-title-letter-spacing)");
    });

    it("should have visual accent indicator", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow container span, then find the accent line within it
      const eyebrowContainer = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.getAttribute("style")?.includes("display: inline-flex") &&
          el.textContent?.includes("Welcome"),
      );
      expect(eyebrowContainer).toBeDefined();
      const accentLine = eyebrowContainer?.querySelector('[aria-hidden="true"]');

      expect(accentLine).toBeInTheDocument();
      expect(accentLine?.getAttribute("style")).toContain("width: 24px");
      expect(accentLine?.getAttribute("style")).toContain("height: 2px");
    });
  });

  describe("Responsive design", () => {
    it("should use responsive font sizing with clamp for title", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const title = container.querySelector("h1, h2, h3, h4, h5, h6");
      const titleStyles = title?.getAttribute("style");

      // Title uses fluid typography
      expect(titleStyles).toContain("clamp(var(--type-page-title-size), 4vw, var(--type-display-size))");
    });

    it("should use responsive padding with clamp", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Query for header element and check its style attribute
      const cardHeader = container.querySelector("header");
      expect(cardHeader).toBeInTheDocument();
      const headerStyles = cardHeader?.getAttribute("style");
      expect(headerStyles).toContain("clamp(1.5rem, 5vw, 3.5rem)");
    });

    it("should have maximum width constraint for readability", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
      const styles = article?.getAttribute("style");

      expect(styles).toContain("max-width: 900px");
      expect(styles).toContain("width: 100%");
    });

    it("should center content horizontally", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const section = container.querySelector("section");
      const styles = section?.getAttribute("style");

      expect(styles).toContain("align-items: center");
      expect(styles).toContain("justify-content: center");
    });

    it("should adapt to different viewport sizes", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const section = container.querySelector("section");
      const styles = section?.getAttribute("style");

      // Section should be flexible
      expect(styles).toContain("flex: 1");
      expect(styles).toContain("display: flex");
    });
  });

  describe("Content structure", () => {
    it("should group related content in header", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Eyebrow, title, and description should be in CardHeader
      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();

      const headerContent = header?.textContent;
      expect(headerContent).toContain("Welcome");
      expect(headerContent).toContain("Getting Started with FitVibe");
      expect(headerContent).toContain("Track your workouts");
    });

    it("should separate additional content in CardContent", () => {
      const { container } = render(
        <PageIntro {...defaultProps}>
          <p data-testid="child">Additional content</p>
        </PageIntro>,
      );

      const child = screen.getByTestId("child");
      const header = container.querySelector("header");

      // Child should not be inside header
      expect(header).not.toContainElement(child);
    });

    it("should have proper spacing between sections", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const header = container.querySelector("header");
      const headerStyles = header?.getAttribute("style");

      expect(headerStyles).toContain("gap: 1rem");
    });

    it("should have proper spacing for child content", () => {
      const { container } = render(
        <PageIntro {...defaultProps}>
          <p>Child content</p>
        </PageIntro>,
      );

      const cardContent = container.querySelector('[style*="gap: 1.5rem"]');
      expect(cardContent).toBeInTheDocument();
    });
  });

  describe("Text content flexibility", () => {
    it("should handle long titles gracefully", () => {
      const longTitle = "This is a very long title that should wrap properly and remain readable";
      render(<PageIntro {...defaultProps} title={longTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it("should handle long descriptions gracefully", () => {
      const longDescription =
        "This is a very long description that provides extensive information about the page content and should wrap properly across multiple lines while maintaining good readability.";
      render(<PageIntro {...defaultProps} description={longDescription} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it("should handle short content appropriately", () => {
      const shortProps = {
        eyebrow: "Hi",
        title: "Welcome",
        description: "Start here.",
      };
      const { container } = render(<PageIntro {...shortProps} />);

      // Use container-scoped queries to avoid multiple element issues
      const eyebrowElements = Array.from(container.querySelectorAll("*")).filter(
        (el) => el.textContent === "Hi",
      );
      expect(eyebrowElements.length).toBeGreaterThan(0);

      const titleElements = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(
        (el) => el.textContent === "Welcome",
      );
      expect(titleElements.length).toBeGreaterThan(0);

      const descriptionElements = Array.from(container.querySelectorAll("p")).filter(
        (el) => el.textContent === "Start here.",
      );
      expect(descriptionElements.length).toBeGreaterThan(0);
    });

    it("should handle special characters in content", () => {
      const specialProps = {
        eyebrow: "Step #1",
        title: "Getting Started & Setting Up",
        description: 'Track "PRs" & monitor progress—it\'s that simple!',
      };
      const { container } = render(<PageIntro {...specialProps} />);

      // Use container-scoped queries to avoid multiple element issues
      const eyebrowElements = Array.from(container.querySelectorAll("*")).filter(
        (el) => el.textContent === "Step #1",
      );
      expect(eyebrowElements.length).toBeGreaterThan(0);

      const titleElements = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(
        (el) => el.textContent === "Getting Started & Setting Up",
      );
      expect(titleElements.length).toBeGreaterThan(0);

      const descriptionElements = Array.from(container.querySelectorAll("p")).filter((el) =>
        el.textContent?.includes('Track "PRs"'),
      );
      expect(descriptionElements.length).toBeGreaterThan(0);
    });
  });

  describe("Layout and spacing", () => {
    it("should have adequate padding for content", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const section = container.querySelector("section");
      const sectionStyles = section?.getAttribute("style");

      // Check for responsive padding using clamp values
      // Vertical: clamp(2rem, 8vw, 5rem) - min 2rem, max 5rem
      // Horizontal: clamp(1rem, 4vw, 1.5rem) - min 1rem, max 1.5rem
      expect(sectionStyles).toContain("padding:");
      expect(sectionStyles).toContain("clamp(2rem, 8vw, 5rem)");
      expect(sectionStyles).toContain("clamp(1rem, 4vw, 1.5rem)");
    });

    it("should align content vertically and horizontally", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      const section = container.querySelector("section");
      const sectionStyles = section?.getAttribute("style");

      expect(sectionStyles).toContain("display: flex");
      expect(sectionStyles).toContain("align-items: center");
      expect(sectionStyles).toContain("justify-content: center");
    });

    it("should have eyebrow visual alignment", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow container span (parent of the text span)
      // The container has display: inline-flex, the text span is its child
      const eyebrowContainer = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.getAttribute("style")?.includes("display: inline-flex") &&
          el.textContent?.includes("Welcome"),
      );
      expect(eyebrowContainer).toBeDefined();
      const eyebrowContainerStyles = eyebrowContainer?.getAttribute("style");

      expect(eyebrowContainerStyles).toContain("display: inline-flex");
      expect(eyebrowContainerStyles).toContain("align-items: center");
      expect(eyebrowContainerStyles).toContain("gap: 0.6rem");
    });
  });

  describe("Decorative elements", () => {
    it("should include visual accent line for eyebrow", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow container span, then find the accent line within it
      const eyebrowContainer = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.getAttribute("style")?.includes("display: inline-flex") &&
          el.textContent?.includes("Welcome"),
      );
      expect(eyebrowContainer).toBeDefined();
      const accentLine = eyebrowContainer?.querySelector('[aria-hidden="true"]');

      expect(accentLine).toBeInTheDocument();
      expect(accentLine?.getAttribute("style")).toContain("width: 24px");
    });

    it("should use accent color for visual line", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Use container-scoped query to avoid multiple element issues
      const eyebrowText = Array.from(container.querySelectorAll("*")).find(
        (el) => el.textContent === "Welcome",
      );
      expect(eyebrowText).toBeDefined();
      const eyebrowContainer = eyebrowText?.parentElement;
      const accentLine = eyebrowContainer?.querySelector('[aria-hidden="true"]');
      const styles = accentLine?.getAttribute("style");

      expect(styles).toContain("background: var(--color-accent)");
    });
  });

  describe("Typography", () => {
    it("should use uppercase for eyebrow text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has text-transform style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("text-transform: uppercase"),
      );
      expect(eyebrowText).toBeDefined();
      const styles = eyebrowText?.getAttribute("style");

      expect(styles).toContain("text-transform: uppercase");
    });

    it("should use appropriate font weights", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has font-weight style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" && el.getAttribute("style")?.includes("font-weight: var(--font-weight-semibold)"),
      );
      expect(eyebrowText).toBeDefined();
      const eyebrowStyles = eyebrowText?.getAttribute("style");

      expect(eyebrowStyles).toContain("font-weight: var(--font-weight-semibold)");
    });

    it("should use semantic color for secondary text", () => {
      const { container } = render(<PageIntro {...defaultProps} />);

      // Find the eyebrow text span (has color style, not the container)
      const eyebrowText = Array.from(container.querySelectorAll("span")).find(
        (el) =>
          el.textContent === "Welcome" &&
          el.getAttribute("style")?.includes("color: var(--color-text-secondary)"),
      );
      expect(eyebrowText).toBeDefined();
      const styles = eyebrowText?.getAttribute("style");

      expect(styles).toContain("color: var(--color-text-secondary)");
    });
  });
});
