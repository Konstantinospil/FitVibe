import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../../src/styles/global.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../packages/ui/src";

describe("Card", () => {
  it("renders header, title, description, and content", () => {
    const { unmount } = render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Weekly Load</CardTitle>
          <CardDescription>Planned vs completed sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <span>42 sessions</span>
        </CardContent>
      </Card>,
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText(/weekly load/i)).toBeVisible();
    expect(screen.getByText(/planned vs completed/i)).toBeVisible();
    expect(screen.getByText(/42 sessions/i)).toBeVisible();

    // Explicitly unmount to ensure cleanup
    unmount();
  });
});
