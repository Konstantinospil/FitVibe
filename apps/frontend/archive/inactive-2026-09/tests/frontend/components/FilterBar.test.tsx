import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "../../src/components/utils/FilterBar";

describe("FilterBar", () => {
  it("renders active filters and removes one when requested", () => {
    const onRemoveFilter = vi.fn();
    render(
      <FilterBar
        filters={[{ key: "status", label: "Status", value: "all" }]}
        onRemoveFilter={onRemoveFilter}
      />,
    );

    expect(screen.getByText("Status: all")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Status" }));
    expect(onRemoveFilter).toHaveBeenCalledWith("status");
  });

  it("renders nothing when there are no filters", () => {
    const { container } = render(<FilterBar filters={[]} onRemoveFilter={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("clears all filters when more than one is active", () => {
    const onClearAll = vi.fn();
    render(
      <FilterBar
        filters={[
          { key: "status", label: "Status", value: "all" },
          { key: "type", label: "Type", value: "strength" },
        ]}
        onRemoveFilter={vi.fn()}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
