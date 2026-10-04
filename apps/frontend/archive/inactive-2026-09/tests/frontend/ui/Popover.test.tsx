import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover } from "../../src/components/ui/Popover";

describe("Popover", () => {
  it("toggles open and close with trigger and close button", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover
        title="Details"
        trigger={<button type="button">Open</button>}
        onOpenChange={onOpenChange}
      >
        <div>Popover content</div>
      </Popover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Popover content")).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not close on outside click when disabled", () => {
    render(
      <Popover trigger={<button type="button">Open</button>} closeOnClickOutside={false}>
        <div>Popover content</div>
      </Popover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.mouseDown(document.body);
    expect(screen.getByText("Popover content")).toBeInTheDocument();
  });
});
