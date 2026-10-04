import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section, SectionHeader } from "../../src/components/composites/Section";

describe("Section composites", () => {
  it("renders the default section element and supports alternate elements", () => {
    const { rerender, container } = render(<Section>Content</Section>);
    expect(container.querySelector("section[data-component='section']")).toBeInTheDocument();

    rerender(<Section as="article">Article content</Section>);
    expect(container.querySelector("article[data-component='section']")).toBeInTheDocument();

    rerender(<Section as="div">Div content</Section>);
    expect(container.querySelector("div[data-component='section']")).toBeInTheDocument();
  });

  it("renders optional description and actions only when supplied", () => {
    const { rerender } = render(<SectionHeader title="Title" />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();

    rerender(
      <SectionHeader
        title="Title"
        description="Description"
        actions={<button type="button">Action</button>}
      />,
    );

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});
