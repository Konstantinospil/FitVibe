import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "../../../packages/ui/src/IconButton";

const CloseIcon = () => <span data-testid="close-icon">×</span>;

describe("IconButton", () => {
  it.each(["ghost", "surface", "danger"] as const)(
    "exposes the %s design-system variant",
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
      expect(button).toHaveAttribute("data-component", "icon-button");
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it("keeps visual hover behavior in CSS rather than React state", () => {
    render(<IconButton icon={<CloseIcon />} label="Close" data-testid="button" />);
    const button = screen.getByTestId("button");
    fireEvent.mouseEnter(button);
    expect(button).toHaveAttribute("data-variant", "ghost");
    fireEvent.mouseLeave(button);
    expect(button).toHaveAttribute("data-variant", "ghost");
  });

  it.each(["ghost", "surface", "danger"] as const)(
    "preserves disabled semantics for %s",
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
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it("uses the predefined large control size by default", () => {
    render(<IconButton icon={<CloseIcon />} label="Close" data-testid="button" />);
    expect(screen.getByTestId("button")).toHaveAttribute("data-size", "lg");
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
