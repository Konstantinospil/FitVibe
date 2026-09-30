import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stack } from "../../src/components/layout/Stack";

describe("Stack", () => {
  it("renders a column flex layout by default", () => {
    render(
      <Stack data-testid="stack">
        <span>One</span>
        <span>Two</span>
      </Stack>,
    );

    expect(screen.getByTestId("stack")).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-md)",
      alignItems: "stretch",
      justifyContent: "start",
      flexWrap: "nowrap",
    });
  });

  it("applies direction, gap, alignment, and wrap", () => {
    render(
      <Stack
        data-testid="stack"
        direction="row"
        gap="xl"
        align="center"
        justify="space-between"
        wrap
      >
        Item
      </Stack>,
    );

    expect(screen.getByTestId("stack")).toHaveStyle({
      flexDirection: "row",
      gap: "var(--space-xl)",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
    });
  });
});
