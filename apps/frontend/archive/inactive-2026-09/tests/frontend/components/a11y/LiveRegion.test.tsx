import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveRegion } from "../../src/components/a11y/LiveRegion";

describe("LiveRegion", () => {
  it("announces children politely by default", () => {
    render(<LiveRegion>Saved</LiveRegion>);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveTextContent("Saved");
  });

  it("supports assertive announcements and a custom id", () => {
    render(
      <LiveRegion level="assertive" id="status-region">
        Error
      </LiveRegion>,
    );

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("id", "status-region");
  });
});
