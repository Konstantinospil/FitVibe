import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../../src/components/progress/MetricCard";

describe("MetricCard", () => {
  it("formats numeric values and shows a trend", () => {
    render(<MetricCard label="Sessions" value={1200} trend="+12%" />);

    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText(Number(1200).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders string values without formatting", () => {
    render(<MetricCard label="Streak" value="4 days" />);
    expect(screen.getByText("4 days")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    const { container } = render(<MetricCard label="Volume" value={10} loading trend="+1" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});
