import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../../src/components/ui/ProgressBar";

describe("ProgressBar", () => {
  it("renders a progressbar with clamped percentage", () => {
    render(<ProgressBar value={150} max={100} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "150");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-label", "100% complete");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("clamps negative values to zero", () => {
    render(<ProgressBar value={-10} />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ width: "0%" });
  });

  it("shows a label when requested", () => {
    render(<ProgressBar value={40} showLabel />);
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("applies size and variant styles", () => {
    const { rerender } = render(<ProgressBar value={10} size="sm" variant="success" />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ background: "var(--color-success)" });

    rerender(<ProgressBar value={10} size="lg" variant="warning" />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ background: "var(--color-warning)" });

    rerender(<ProgressBar value={10} variant="danger" />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ background: "var(--color-danger)" });
  });
});
