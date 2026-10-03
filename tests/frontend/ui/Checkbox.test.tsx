import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../../../packages/ui/src/Checkbox";

describe("Checkbox", () => {
  it("renders inactive and active states", () => {
    const { rerender } = render(<Checkbox label="Accept" checked={false} onChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    const root = checkbox.closest("[data-component='checkbox']");

    expect(root).toHaveAttribute("data-state", "inactive");

    rerender(<Checkbox label="Accept" checked onChange={vi.fn()} />);
    expect(root).toHaveAttribute("data-state", "active");
    expect(root?.querySelector("[data-slot='checkbox-check']")).toBeInTheDocument();
  });

  it("uses hover state without changing checked value", () => {
    render(<Checkbox label="Accept" checked onChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    const root = checkbox.closest("[data-component='checkbox']");
    const label = screen.getByText("Accept").closest("label");

    fireEvent.mouseEnter(label!);
    expect(root).toHaveAttribute("data-state", "hover");
    expect(checkbox).toBeChecked();

    fireEvent.mouseLeave(label!);
    expect(root).toHaveAttribute("data-state", "active");
  });

  it("uses disabled opacity and prevents interaction", () => {
    render(<Checkbox label="Accept" disabled />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    const root = checkbox.closest("[data-component='checkbox']");

    expect(checkbox).toBeDisabled();
    expect(root).toHaveAttribute("data-state", "disabled");
    expect(root).toHaveStyle({ opacity: "var(--opacity-disabled)" });
  });

  it("supports validation error semantics", () => {
    render(<Checkbox label="Accept" error="Required" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    const root = checkbox.closest("[data-component='checkbox']");

    expect(root).toHaveAttribute("data-state", "error");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("supports uncontrolled interaction", () => {
    render(<Checkbox label="Accept" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
