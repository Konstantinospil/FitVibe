import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressChart } from "../../src/components/progress/ProgressChart";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock("../../src/components/ErrorBoundary", () => ({
  default: ({ children }: { children: import("react").ReactNode }) => children,
}));

vi.mock("../../src/components/ui/Chart", () => ({
  Chart: ({ type }: { type: string }) => <div data-testid="chart">{type}</div>,
}));

describe("ProgressChart", () => {
  const data = [{ date: "2026-01-01", value: 10 }];

  it("renders a loading skeleton", () => {
    const { container } = render(<ProgressChart title="Volume" data={[]} loading />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("renders an error state with retry", () => {
    const onRetry = vi.fn();
    render(<ProgressChart title="Volume" data={[]} error={new Error("boom")} onRetry={onRetry} />);

    expect(screen.getByText("progress.failedToLoad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "progress.retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders an empty state", () => {
    render(<ProgressChart title="Volume" data={[]} emptyMessage="No volume" />);
    expect(screen.getByText("No volume")).toBeInTheDocument();
  });

  it("falls back to the translated empty message", () => {
    render(<ProgressChart title="Volume" data={[]} />);
    expect(screen.getByText("progress.noData")).toBeInTheDocument();
  });

  it("renders a chart with a date range", () => {
    render(
      <ProgressChart
        title="Volume"
        data={data}
        type="bar"
        dateRange={{ from: "Jan 1", to: "Jan 7" }}
      />,
    );

    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Jan 1 → Jan 7")).toBeInTheDocument();
    expect(screen.getByTestId("chart")).toHaveTextContent("bar");
  });
});
