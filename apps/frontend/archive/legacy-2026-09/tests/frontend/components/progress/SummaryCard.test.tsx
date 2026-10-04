import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummaryCard } from "../../src/components/progress/SummaryCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SummaryCard", () => {
  it("renders a loading skeleton", () => {
    render(<SummaryCard title="Weekly" period="weekly" data={[]} loading />);
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    render(<SummaryCard title="Weekly" period="weekly" data={[]} emptyMessage="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("falls back to the translated empty message", () => {
    render(<SummaryCard title="Weekly" period="weekly" data={[]} />);
    expect(screen.getByText("progress.noData")).toBeInTheDocument();
  });

  it("renders summary rows with singular and plural session labels", () => {
    render(
      <SummaryCard
        title="Monthly"
        period="monthly"
        data={[
          { period: "Week 1", sessions: 1, volume: 1500, duration: 40, intensity: 7.25 },
          { period: "Week 2", sessions: 3 },
        ]}
      />,
    );

    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText(/1\s+progress.session/)).toBeInTheDocument();
    expect(screen.getByText("1.5k kg")).toBeInTheDocument();
    expect(screen.getByText("40 min")).toBeInTheDocument();
    expect(screen.getByText("7.3 RPE")).toBeInTheDocument();
    expect(screen.getByText(/3\s+progress.sessions/)).toBeInTheDocument();
  });
});
