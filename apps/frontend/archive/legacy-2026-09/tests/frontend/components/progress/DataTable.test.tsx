import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../../src/components/progress/DataTable";

describe("DataTable", () => {
  it("renders loading state", () => {
    render(<DataTable title="Metrics" columns={[]} data={[]} loading />);
    expect(screen.getByText("Metrics")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<DataTable columns={[]} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders table rows after toggling visibility", () => {
    render(
      <DataTable
        title="Metrics"
        columns={[
          { key: "label", label: "Label" },
          { key: "value", label: "Value", align: "right" },
        ]}
        data={[{ label: "Distance", value: 42 }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Distance")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
