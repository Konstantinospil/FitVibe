import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { DateRangePicker } from "../../src/components/DateRangePicker";

describe("DateRangePicker", () => {
  const defaultRange = {
    from: "2025-01-01",
    to: "2025-01-31",
  };

  it("should render date range picker with from and to inputs", () => {
    const onChange = vi.fn();
    const { container } = render(<DateRangePicker value={defaultRange} onChange={onChange} />);

    const fromInputs = screen.getAllByLabelText(/from:/i);
    const toInputs = screen.getAllByLabelText(/to:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];
    const toInput = Array.from(toInputs).find((input) => container.contains(input)) || toInputs[0];

    expect(fromInput).toBeInTheDocument();
    expect(toInput).toBeInTheDocument();
    expect(fromInput).toHaveValue("2025-01-01");
    expect(toInput).toHaveValue("2025-01-31");
  });

  it("should call onChange when from date changes", () => {
    const onChange = vi.fn();
    const { container } = render(<DateRangePicker value={defaultRange} onChange={onChange} />);

    // Get the input within our container
    const fromInputs = screen.getAllByLabelText(/from:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];

    // Use fireEvent for date inputs as userEvent can be unreliable with date inputs
    fireEvent.change(fromInput, { target: { value: "2025-01-15" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2025-01-15",
      to: "2025-01-31",
    });
  });

  it("should call onChange when to date changes", () => {
    const onChange = vi.fn();
    const { container } = render(<DateRangePicker value={defaultRange} onChange={onChange} />);

    const toInputs = screen.getAllByLabelText(/to:/i);
    const toInput = (Array.from(toInputs).find((input) => container.contains(input)) ||
      toInputs[0]) as HTMLInputElement;

    // Use fireEvent for date inputs
    fireEvent.change(toInput, { target: { value: "2025-01-20" } });

    // Verify onChange was called with the correct value
    expect(onChange).toHaveBeenCalledWith({
      from: "2025-01-01",
      to: "2025-01-20",
    });
  });

  it("should adjust to date when from date is after to date", () => {
    const onChange = vi.fn();
    const { container } = render(<DateRangePicker value={defaultRange} onChange={onChange} />);

    const fromInputs = screen.getAllByLabelText(/from:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];

    fireEvent.change(fromInput, { target: { value: "2025-02-01" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2025-02-01",
      to: "2025-02-01",
    });
  });

  it("should adjust from date when to date is before from date", () => {
    const onChange = vi.fn();
    const range = {
      from: "2025-01-15",
      to: "2025-01-31",
    };
    const { container } = render(<DateRangePicker value={range} onChange={onChange} />);

    const toInputs = screen.getAllByLabelText(/to:/i);
    const toInput = (Array.from(toInputs).find((input) => container.contains(input)) ||
      toInputs[0]) as HTMLInputElement;

    fireEvent.change(toInput, { target: { value: "2025-01-10" } });

    // Check that onChange was called with adjusted dates
    expect(onChange).toHaveBeenCalledWith({
      from: "2025-01-10",
      to: "2025-01-10",
    });
  });

  it("should apply maxDate to both inputs", () => {
    const onChange = vi.fn();
    const maxDate = "2025-12-31";
    const { container } = render(
      <DateRangePicker value={defaultRange} onChange={onChange} maxDate={maxDate} />,
    );

    const fromInputs = screen.getAllByLabelText(/from:/i);
    const toInputs = screen.getAllByLabelText(/to:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];
    const toInput = Array.from(toInputs).find((input) => container.contains(input)) || toInputs[0];

    expect(fromInput).toHaveAttribute("max", maxDate);
    expect(toInput).toHaveAttribute("max", maxDate);
  });

  it("should apply minDate to both inputs", () => {
    const onChange = vi.fn();
    const minDate = "2025-01-01";
    const { container } = render(
      <DateRangePicker value={defaultRange} onChange={onChange} minDate={minDate} />,
    );

    const fromInputs = screen.getAllByLabelText(/from:/i);
    const toInputs = screen.getAllByLabelText(/to:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];
    const toInput = Array.from(toInputs).find((input) => container.contains(input)) || toInputs[0];

    expect(fromInput).toHaveAttribute("min", minDate);
    expect(toInput).toHaveAttribute("min", minDate);
  });

  it("should use current date as default maxDate when not provided", () => {
    const onChange = vi.fn();
    const today = new Date().toISOString().split("T")[0];
    const { container } = render(<DateRangePicker value={defaultRange} onChange={onChange} />);

    const fromInputs = screen.getAllByLabelText(/from:/i);
    const toInputs = screen.getAllByLabelText(/to:/i);
    const fromInput =
      Array.from(fromInputs).find((input) => container.contains(input)) || fromInputs[0];
    const toInput = Array.from(toInputs).find((input) => container.contains(input)) || toInputs[0];

    expect(fromInput).toBeInTheDocument();
    expect(toInput).toBeInTheDocument();
    expect(fromInput).toHaveAttribute("max", today);
    expect(toInput).toHaveAttribute("max", today);
  });
});
