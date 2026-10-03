import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "../../src/components/ui/DropdownMenu";

describe("DropdownMenu", () => {
  it("renders items and calls onSelect", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        items={[
          { label: "First", value: "first" },
          { label: "Divider", value: "divider", divider: true },
          { label: "Second", value: "second" },
        ]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    fireEvent.click(screen.getByText("First"));
    expect(onSelect).toHaveBeenCalledWith("first");
  });

  it("does not call onSelect for disabled items", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        items={[{ label: "Disabled", value: "disabled", disabled: true }]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByText("Disabled"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports a custom trigger, divider items, and icons", () => {
    render(
      <DropdownMenu
        trigger={<button type="button">Actions</button>}
        items={[
          { label: "First", value: "first", icon: <span data-testid="icon" /> },
          { label: "Divider", value: "divider", divider: true },
          { label: "Second", value: "second" },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("closes the menu when clicking outside", () => {
    render(<DropdownMenu items={[{ label: "Item", value: "item" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByText("Item")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Item")).not.toBeInTheDocument();
  });

  it("updates hover styles only for enabled items", () => {
    render(
      <DropdownMenu
        items={[
          { label: "Enabled", value: "enabled" },
          { label: "Disabled", value: "disabled", disabled: true },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const enabledItem = screen.getByText("Enabled").closest("button");
    const disabledItem = screen.getByText("Disabled").closest("button");

    expect(enabledItem).toBeTruthy();
    expect(disabledItem).toBeTruthy();

    fireEvent.mouseEnter(enabledItem!);
    expect(enabledItem!.style.background).toBe("var(--color-bg-secondary)");
    fireEvent.mouseLeave(enabledItem!);
    expect(enabledItem!.style.background).toBe("transparent");

    fireEvent.mouseEnter(disabledItem!);
    expect(disabledItem!.style.background).toBe("transparent");
  });
});
