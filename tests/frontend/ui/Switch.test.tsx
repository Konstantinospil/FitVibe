import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "../../../packages/ui/src/Switch";

describe("Switch", () => {
  it("renders inactive and active positions", () => {
    const { rerender } = render(<Switch label="Notifications" checked={false} onChange={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    const root = toggle.closest("[data-component='switch']");
    const thumb = root?.querySelector("[data-slot='switch-thumb']") as HTMLElement;

    expect(root).toHaveAttribute("data-state", "inactive");
    expect(thumb.style.left).toBe("3px");

    rerender(<Switch label="Notifications" checked onChange={vi.fn()} />);
    expect(root).toHaveAttribute("data-state", "active");
    expect(thumb.style.left).toBe("27px");
  });

  it("uses hover state without toggling the switch", () => {
    render(<Switch label="Notifications" checked={false} onChange={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    const root = toggle.closest("[data-component='switch']");
    const label = screen.getByText("Notifications").closest("label");

    fireEvent.mouseEnter(label!);
    expect(root).toHaveAttribute("data-state", "hover");
    expect(toggle).not.toBeChecked();

    fireEvent.mouseLeave(label!);
    expect(root).toHaveAttribute("data-state", "inactive");
  });

  it("uses disabled opacity and semantics", () => {
    render(<Switch label="Notifications" checked disabled onChange={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    const root = toggle.closest("[data-component='switch']");

    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(root).toHaveAttribute("data-state", "disabled");
    expect(root).toHaveStyle({ opacity: "var(--opacity-disabled)" });
  });

  it("supports uncontrolled interaction", () => {
    render(<Switch label="Notifications" />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });
});
