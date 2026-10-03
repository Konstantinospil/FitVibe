import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "../../src/components/ui/Switch";

describe("Switch", () => {
  it("renders a labelled switch and forwards a ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Switch ref={ref} label="Allow followers" checked={false} onChange={vi.fn()} />);

    const toggle = screen.getByRole("switch", { name: "Allow followers" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(ref.current).toBe(toggle);
  });

  it("shows helper text unless an error is present", () => {
    const { rerender } = render(
      <Switch helperText="Optional" checked={false} onChange={vi.fn()} />,
    );
    expect(screen.getByText("Optional")).toBeInTheDocument();

    rerender(<Switch helperText="Optional" error="Required" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });

  it("toggles via click and supports disabled styling", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="Notify" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole("switch", { name: "Notify" }));
    expect(onChange).toHaveBeenCalled();

    rerender(<Switch label="Notify" checked disabled onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});
