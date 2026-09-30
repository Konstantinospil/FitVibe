import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PageIntro from "../../src/components/PageIntro";

describe("PageIntro", () => {
  it("should render with eyebrow, title, and description", () => {
    render(<PageIntro eyebrow="Test Eyebrow" title="Test Title" description="Test Description" />);

    expect(screen.getByText("Test Eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("should render children when provided", () => {
    render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description">
        <div data-testid="child-content">Child Content</div>
      </PageIntro>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("should not render children section when children are not provided", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );

    // CardContent should not be rendered when no children
    const cardContent = container.querySelector('[data-testid="card-content"]');
    expect(cardContent).not.toBeInTheDocument();
  });

  it("should render as article element", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );

    const article = container.querySelector("article");
    expect(article).toBeInTheDocument();
  });

  it("should render eyebrow with accent line", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );

    const accentLine = container.querySelector('[aria-hidden="true"]');
    expect(accentLine).toBeInTheDocument();
  });

  it("should apply proper semantic structure", () => {
    render(<PageIntro eyebrow="Eyebrow" title="Title" description="Description" />);

    // Check that eyebrow, title, and description are rendered
    expect(screen.getByText("Eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("should skip backdrop blur when priorityLcp is set", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" priorityLcp />,
    );

    const article = container.querySelector("article") as HTMLElement;
    expect(article.style.backdropFilter).toBe("none");
    const title = screen.getByText("Title") as HTMLElement;
    expect(title.style.color).toBe("var(--color-text-primary, var(--color-on-color))");
  });

  it("should render brand content above the eyebrow", () => {
    render(
      <PageIntro
        eyebrow="Eyebrow"
        title="Title"
        description="Description"
        brand={<img alt="FitVibe" src="/logo.png" />}
      />,
    );

    expect(screen.getByRole("img", { name: "FitVibe" })).toBeInTheDocument();
  });

  it("should omit the eyebrow when it is not provided", () => {
    render(<PageIntro title="Title" description="Description" />);

    expect(screen.queryByText("Eyebrow")).not.toBeInTheDocument();
  });

  it("should render actions after the header", () => {
    render(
      <PageIntro
        title="Title"
        description="Description"
        actions={<button type="button">Back</button>}
      >
        <div>Body</div>
      </PageIntro>,
    );

    const header = screen.getByText("Title").closest("header");
    const button = screen.getByRole("button", { name: "Back" });
    expect(header).toBeInTheDocument();
    expect(button).toBeInTheDocument();
    expect(header?.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
