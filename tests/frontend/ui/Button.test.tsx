import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../packages/ui/src";

describe("Button", () => {
  it("renders children and triggers click handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(["primary", "secondary", "danger", "ghost"] as const)(
    "exposes the %s design-system variant",
    (variant) => {
      render(
        <Button variant={variant} data-testid={`button-${variant}`}>
          Continue
        </Button>,
      );
      const button = screen.getByTestId(`button-${variant}`);
      expect(button).toHaveAttribute("data-ui", "button");
      expect(button).toHaveAttribute("data-component", "button");
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it.each(["sm", "md", "lg"] as const)("exposes the %s design-system size", (size) => {
    render(
      <Button size={size} data-testid={`button-${size}`}>
        Continue
      </Button>,
    );
    expect(screen.getByTestId(`button-${size}`)).toHaveAttribute("data-size", size);
  });

  it("keeps semantic active state while CSS owns hover presentation", () => {
    render(<Button data-testid="state-button">Continue</Button>);
    const button = screen.getByTestId("state-button");
    expect(button).toHaveAttribute("data-state", "active");
    fireEvent.mouseEnter(button);
    expect(button).toHaveAttribute("data-state", "active");
    fireEvent.mouseLeave(button);
    expect(button).toHaveAttribute("data-state", "active");
  });

  it("uses the disabled semantic state", () => {
    render(
      <Button disabled data-testid="disabled-button">
        Continue
      </Button>,
    );
    const button = screen.getByTestId("disabled-button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-state", "disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the label visible and renders a leading spinner while loading", () => {
    render(
      <Button isLoading data-testid="loading-button">
        Continue
      </Button>,
    );
    const button = screen.getByTestId("loading-button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-state", "loading");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Continue")).toBeVisible();
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
  });

  it("supports leading and trailing icons", () => {
    render(
      <Button
        leadingIcon={<span data-testid="leading-source">L</span>}
        trailingIcon={<span data-testid="trailing-source">R</span>}
      >
        Continue
      </Button>,
    );
    expect(screen.getByTestId("leading-source").closest("[data-slot='leading-icon']")).toBeTruthy();
    expect(screen.getByTestId("trailing-source").closest("[data-slot='trailing-icon']")).toBeTruthy();
  });

  it("keeps leftIcon and rightIcon as compatibility aliases", () => {
    render(
      <Button
        leftIcon={<span data-testid="left-source">L</span>}
        rightIcon={<span data-testid="right-source">R</span>}
      >
        Continue
      </Button>,
    );
    expect(screen.getByTestId("left-source")).toBeInTheDocument();
    expect(screen.getByTestId("right-source")).toBeInTheDocument();
  });
});
