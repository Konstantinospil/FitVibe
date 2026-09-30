import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Container } from "../../src/components/layout/Container";

describe("Container", () => {
  it("renders children with the default xl max-width and padding", () => {
    render(<Container>Content</Container>);

    const container = screen.getByText("Content");
    expect(container).toHaveStyle({ maxWidth: "1280px", width: "100%" });
  });

  it("applies each max-width token", () => {
    const { rerender } = render(<Container maxWidth="sm">Content</Container>);
    expect(screen.getByText("Content")).toHaveStyle({ maxWidth: "640px" });

    rerender(<Container maxWidth="md">Content</Container>);
    expect(screen.getByText("Content")).toHaveStyle({ maxWidth: "768px" });

    rerender(<Container maxWidth="lg">Content</Container>);
    expect(screen.getByText("Content")).toHaveStyle({ maxWidth: "1024px" });

    rerender(<Container maxWidth="2xl">Content</Container>);
    expect(screen.getByText("Content")).toHaveStyle({ maxWidth: "1536px" });

    rerender(<Container maxWidth="full">Content</Container>);
    expect(screen.getByText("Content")).toHaveStyle({ maxWidth: "100%" });
  });

  it("omits horizontal padding when padding is false", () => {
    render(
      <Container padding={false} data-testid="container">
        Content
      </Container>,
    );

    expect(screen.getByTestId("container")).not.toHaveStyle({
      paddingLeft: "var(--space-lg)",
    });
  });

  it("merges custom className and style", () => {
    render(
      <Container className="extra" style={{ background: "red" }} data-testid="container">
        Content
      </Container>,
    );

    const container = screen.getByTestId("container");
    expect(container).toHaveClass("extra");
    expect(container).toHaveStyle({ background: "red" });
  });
});
