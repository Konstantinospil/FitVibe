import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "../../../packages/ui/src/DropdownMenu";

const SearchIcon = () => <span data-testid="search-icon">Q</span>;

const items = [
  { value: "a", label: "First", leadingIcon: <SearchIcon />, trailingIcon: <SearchIcon /> },
  { value: "b", label: "Second", leadingIcon: <SearchIcon />, trailingIcon: <SearchIcon /> },
  { value: "c", label: "Disabled", disabled: true },
] as const;

describe("DropdownMenu", () => {
  it("renders the clicked/open Figma composition", () => {
    render(
      <DropdownMenu
        label="Label"
        items={items}
        defaultOpen
        ariaLabel="Example menu"
      />,
    );

    expect(screen.getByRole("button", { name: "Example menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("menu", { name: "Example menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });

  it("can toggle the leading-icon column off", () => {
    const { rerender } = render(
      <DropdownMenu
        label="Label"
        items={items}
        defaultOpen
        showLeadingIcons
      />,
    );

    expect(
      document.querySelectorAll("[data-slot='dropdown-leading-icon']"),
    ).toHaveLength(3);

    rerender(
      <DropdownMenu
        label="Label"
        items={items}
        defaultOpen
        showLeadingIcons={false}
      />,
    );

    expect(
      document.querySelectorAll("[data-slot='dropdown-leading-icon']"),
    ).toHaveLength(0);
  });

  it("supports optional trailing icons independently", () => {
    render(
      <DropdownMenu
        label="Label"
        items={items}
        defaultOpen
        showTrailingIcons={false}
      />,
    );

    expect(
      document.querySelectorAll("[data-slot='dropdown-trailing-icon']"),
    ).toHaveLength(0);
  });

  it("exposes selected and disabled item states", () => {
    render(
      <DropdownMenu label="Label" items={items} value="b" defaultOpen />,
    );

    expect(screen.getByRole("menuitemradio", { name: "Second" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Disabled" })).toBeDisabled();
  });

  it("selects an item and closes the menu", () => {
    const onValueChange = vi.fn();
    render(
      <DropdownMenu
        label="Label"
        items={items}
        defaultOpen
        onValueChange={onValueChange}
        ariaLabel="Example menu"
      />,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Second" }));

    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Example menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("supports keyboard navigation and escape", () => {
    render(
      <DropdownMenu label="Label" items={items} ariaLabel="Example menu" />,
    );

    const trigger = screen.getByRole("button", { name: "Example menu" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("menu")).toBeInTheDocument();

    const first = screen.getByRole("menuitemradio", { name: "First" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "Second" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menuitemradio", { name: "Second" }), {
      key: "Escape",
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
