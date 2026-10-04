import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInput } from "../../src/components/utils/SearchInput";

describe("SearchInput", () => {
  it("renders placeholder and triggers onChange", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "lift" } });

    expect(onChange).toHaveBeenCalledWith("lift");
  });

  it("supports custom placeholder", () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Find workouts" />);

    expect(screen.getByPlaceholderText("Find workouts")).toBeInTheDocument();
  });

  it("clears the value and notifies onClear", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput value="bench" onChange={onChange} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalled();
  });

  it("hides the clear button when showClearButton is false", () => {
    render(<SearchInput value="bench" onChange={() => {}} showClearButton={false} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });
});
