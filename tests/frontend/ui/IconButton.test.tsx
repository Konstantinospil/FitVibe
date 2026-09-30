import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "../../../packages/ui/src/IconButton";

const CloseIcon = () => <span data-testid="close-icon">×</span>;

describe("IconButton", () => {
  it.each([
    ["ghost", "transparent", "var(--color-text-secondary)"],
    ["surface", "var(--color-surface)", "var(--color-text-secondary)"],
    ["danger", "transparent", "var(--color-danger-text)"],
  ] as const)("renders the %s active variant", (variant, background, color) => {
    render(
      <IconButton
        icon={<CloseIcon />}
        label="Close"
        variant={variant}
        data-testid="button"
      />,
    );

    const button = screen.getByTestId("button");
    expect(button).toHaveAttribute("data-state", "active");
    expect(button).toHaveAttribute("data-variant", variant);
    expect(button).toHaveStyle({ background, color });
  });

  it.each(["ghost", "surface", "danger"] as const)(
    "renders hover state for %s",
    (variant) => {
      render(
        <IconButton
          icon={<CloseIcon />}
          label="Close"
          variant={variant}
          data-testid="button"
        />,
      );
      const button = screen.getByTestId("button");

      fireEvent.mouseEnter(button);
      expect(button).toHaveAttribute("data-state", "hover");

      fireEvent.mouseLeave(button);
      expect(button).toHaveAttribute("data-state", "active");
    },
  );

  it.each(["ghost", "surface", "danger"] as const)(
    "renders disabled state for %s",
    (variant) => {
      render(
        <IconButton
          icon={<CloseIcon />}
          label="Close"
          variant={variant}
          disabled
          data-testid="button"
        />,
      );

      const button = screen.getByTestId("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("data-state", "disabled");
      expect(button).toHaveStyle({ opacity: "var(--opacity-disabled)" });
    },
  );

  it("uses the predefined large control size by default", () => {
    render(<IconButton icon={<CloseIcon />} label="Close" data-testid="button" />);
    expect(screen.getByTestId("button")).toHaveAttribute("data-size", "lg");
    expect(screen.getByTestId("button")).toHaveStyle({
      width: "48px",
      height: "48px",
    });
  });

  it("renders an external icon link without changing the sizing API", () => {
    render(
      <IconButton
        icon={<CloseIcon />}
        label="Social"
        href="https://example.com"
        target="_blank"
        rel="noopener noreferrer"
        size="lg"
      />,
    );

    const link = screen.getByRole("link", { name: "Social" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("data-size", "lg");
  });

  it("fires click through the accessible icon-only control", () => {
    const onClick = vi.fn();
    render(<IconButton icon={<CloseIcon />} label="Close" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
