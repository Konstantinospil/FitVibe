import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressDashboard } from "../../src/components/progress/ProgressDashboard";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Chart", () => ({
  Chart: () => <div data-testid="chart" />,
}));

vi.mock("../../src/components/ErrorBoundary", () => ({
  default: ({ children }: { children: import("react").ReactNode }) => children,
}));

describe("ProgressDashboard", () => {
  it("renders metrics, records, charts, and the exercise table", () => {
    render(
      <ProgressDashboard
        summaryMetrics={[{ id: "sessions", label: "Sessions", value: 12, trend: "+2" }]}
        personalRecords={[
          { lift: "Squat", value: "140 kg", achieved: "2026-01-01", visibility: "public" },
        ]}
        volumeChartData={[{ date: "2026-01-01", value: 10 }]}
        sessionsChartData={[{ date: "2026-01-01", value: 1 }]}
        intensityChartData={[{ date: "2026-01-01", value: 7 }]}
        exerciseBreakdownData={[
          {
            exerciseId: "ex-1",
            exerciseName: "Bench",
            totalSessions: 4,
            totalVolume: 12000,
            avgVolume: 3000,
            maxWeight: 80,
            trend: "up",
          },
        ]}
        onRangeModeChange={vi.fn()}
        onPeriodChange={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("progress.volumeTrend")).toBeInTheDocument();
    expect(screen.getByText("progress.sessionsTrend")).toBeInTheDocument();
    expect(screen.getByText("progress.intensityTrend")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(screen.getByText("12.0k kg")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("progress.trendUp")).toBeInTheDocument();
  });

  it("hides filters when no handlers are provided", () => {
    render(<ProgressDashboard />);
    expect(screen.queryByText("progress.presetRange")).not.toBeInTheDocument();
  });

  it("forwards filter changes", () => {
    const onPeriodChange = vi.fn();
    render(<ProgressDashboard onPeriodChange={onPeriodChange} period={7} />);
    fireEvent.change(screen.getByDisplayValue("progress.7days"), { target: { value: "30" } });
    expect(onPeriodChange).toHaveBeenCalledWith(30);
  });
});
