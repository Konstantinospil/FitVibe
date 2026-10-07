import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageIntro from "../../src/components/PageIntro";

describe("PageIntro", () => {
  it("renders eyebrow, title, and description", () => {
    render(<PageIntro eyebrow="Test Eyebrow" title="Test Title" description="Test Description" />);
    expect(screen.getByText("Test Eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("renders children when provided", () => {
    render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description">
        <div data-testid="child-content">Child Content</div>
      </PageIntro>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("omits CardContent when children are not provided", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );
    expect(container.querySelector("[data-component='card-content']")).not.toBeInTheDocument();
  });

  it("renders the central page-intro and card contracts", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );
    expect(container.querySelector("[data-component='page-intro']")).toBeInTheDocument();
    expect(container.querySelector("article[data-slot='page-intro-card']")).toBeInTheDocument();
  });

  it("renders eyebrow with the semantic accent slots", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" />,
    );
    expect(container.querySelector("[data-slot='page-intro-eyebrow']")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='page-intro-accent']")).toBeInTheDocument();
  });

  it("marks the priority-LCP variant without inline visual styling", () => {
    const { container } = render(
      <PageIntro eyebrow="Eyebrow" title="Title" description="Description" priorityLcp />,
    );
    expect(container.querySelector("article")).toHaveAttribute("data-priority-lcp", "true");
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "page-intro-title");
  });

  it("renders brand content above the eyebrow", () => {
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

  it("omits the eyebrow when it is not provided", () => {
    const { container } = render(<PageIntro title="Title" description="Description" />);
    expect(container.querySelector("[data-slot='page-intro-eyebrow']")).not.toBeInTheDocument();
  });

  it("renders actions after the header", () => {
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
