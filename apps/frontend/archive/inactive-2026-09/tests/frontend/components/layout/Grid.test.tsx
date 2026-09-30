import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Grid } from "../../src/components/layout/Grid";

describe("Grid", () => {
  it("renders a single-column grid by default", () => {
    render(
      <Grid data-testid="grid">
        <span>Cell</span>
      </Grid>,
    );

    expect(screen.getByTestId("grid")).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(1, 1fr)",
      gap: "var(--space-md)",
    });
  });

  it("uses a numeric column count", () => {
    render(
      <Grid data-testid="grid" columns={3} gap="lg">
        Cell
      </Grid>,
    );

    expect(screen.getByTestId("grid")).toHaveStyle({
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "var(--space-lg)",
    });
  });

  it("uses the largest breakpoint from a responsive columns object", () => {
    render(
      <Grid data-testid="grid" columns={{ sm: 1, md: 2, lg: 3, xl: 4 }}>
        Cell
      </Grid>,
    );

    expect(screen.getByTestId("grid")).toHaveStyle({
      gridTemplateColumns: "repeat(4, 1fr)",
    });
  });

  it("falls back through missing responsive breakpoints", () => {
    render(
      <Grid data-testid="grid" columns={{ sm: 2 }}>
        Cell
      </Grid>,
    );

    expect(screen.getByTestId("grid")).toHaveStyle({
      gridTemplateColumns: "repeat(2, 1fr)",
    });
  });
});
