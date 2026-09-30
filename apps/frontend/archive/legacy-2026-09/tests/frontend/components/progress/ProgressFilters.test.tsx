import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressFilters } from "../../src/components/progress/ProgressFilters";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/components/DateRangePicker", () => ({
  default: ({ onChange }: { onChange: (range: { from: string; to: string }) => void }) => (
    <button type="button" onClick={() => onChange({ from: "2026-01-01", to: "2026-01-31" })}>
      Custom range
    </button>
  ),
}));

describe("ProgressFilters", () => {
  const props = {
    rangeMode: "preset" as const,
    onRangeModeChange: vi.fn(),
    period: 7,
    onPeriodChange: vi.fn(),
    customRange: { from: "2026-01-01", to: "2026-01-07" },
    onCustomRangeChange: vi.fn(),
    groupBy: "day" as const,
    onGroupByChange: vi.fn(),
  };

  it("changes preset period and grouping", () => {
    render(<ProgressFilters {...props} />);

    fireEvent.change(screen.getByDisplayValue("progress.7days"), { target: { value: "30" } });
    expect(props.onPeriodChange).toHaveBeenCalledWith(30);

    fireEvent.change(screen.getByDisplayValue("progress.daily"), { target: { value: "week" } });
    expect(props.onGroupByChange).toHaveBeenCalledWith("week");
  });

  it("switches to a custom range and exports", () => {
    const onExport = vi.fn();
    const { rerender } = render(<ProgressFilters {...props} onExport={onExport} />);

    fireEvent.click(screen.getByRole("button", { name: "progress.customRange" }));
    expect(props.onRangeModeChange).toHaveBeenCalledWith("custom");

    rerender(<ProgressFilters {...props} rangeMode="custom" onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    expect(props.onCustomRangeChange).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-01-31",
    });

    fireEvent.click(screen.getByRole("button", { name: "progress.exportCsv" }));
    expect(onExport).toHaveBeenCalled();
  });
});
