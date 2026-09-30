import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryView } from "../../src/components/progress/HistoryView";

describe("HistoryView", () => {
  it("renders loading skeletons", () => {
    const { container } = render(<HistoryView sessions={[]} loading />);
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  it("renders empty state", () => {
    render(<HistoryView sessions={[]} emptyMessage="No sessions yet" />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("renders sessions and filters", () => {
    const session = {
      id: "session-1",
      title: "Core",
      status: "completed",
      exercises: [],
    };
    render(
      <HistoryView
        sessions={[session as never]}
        filters={{ dateFrom: "Jan 1", dateTo: "Jan 2", category: "Strength" }}
      />,
    );

    expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2/)).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });
});
