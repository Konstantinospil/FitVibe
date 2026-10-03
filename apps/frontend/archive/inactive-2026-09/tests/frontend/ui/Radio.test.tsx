import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Radio } from "../../src/components/ui/Radio";

describe("Radio", () => {
  it("renders a labelled radio and forwards a ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Radio ref={ref} label="Strength" name="vibe" />);

    const radio = screen.getByRole("radio", { name: "Strength" });
    expect(radio).toHaveAttribute("type", "radio");
    expect(ref.current).toBe(radio);
  });

  it("shows helper text and hides it when an error is present", () => {
    const { rerender } = render(<Radio helperText="Pick one" />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();

    rerender(<Radio helperText="Pick one" error="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.queryByText("Pick one")).not.toBeInTheDocument();
    expect(screen.getByRole("radio")).toHaveAttribute("aria-invalid", "true");
  });

  it("supports disabled state and change events", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Radio label="Option" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio"));
    expect(onChange).toHaveBeenCalled();

    rerender(<Radio label="Option" disabled />);
    expect(screen.getByRole("radio")).toBeDisabled();
  });
});
