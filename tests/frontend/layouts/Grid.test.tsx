import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Grid } from "../../../apps/frontend/src/components/layout/Grid";

afterEach(() => {
  cleanup();
});

describe("Grid", () => {
  it("falls back to one column when responsive column counts are omitted", () => {
    const { getByTestId } = render(
      <Grid columns={{}} data-testid="default-responsive-grid">
        <div>Item</div>
      </Grid>,
    );

    expect(getByTestId("default-responsive-grid")).toHaveStyle({
      gridTemplateColumns: "repeat(1, 1fr)",
    });
  });

  it("falls back from an omitted xl column count to the configured lg count", () => {
    const { getByTestId } = render(
      <Grid columns={{ sm: 2, md: 3, lg: 4 }} data-testid="responsive-grid">
        <div>Item</div>
      </Grid>,
    );

    expect(getByTestId("responsive-grid")).toHaveStyle({
      gridTemplateColumns: "repeat(4, 1fr)",
    });
  });
});
