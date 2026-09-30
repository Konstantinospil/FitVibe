import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputField } from "../../../packages/ui/src/FieldControls";

describe("InputField", () => {
  it("renders the Figma default state", () => {
    render(
      <InputField
        label="Email address"
        placeholder="Enter your email"
        helperText="Helper text"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");

    expect(field).toHaveAttribute("data-state", "default");
    expect(input.style.height).toBe("38px");
    expect(input.style.borderRadius).toBe("var(--radius-md)");
    expect(input.style.borderColor).toBe("var(--color-input-border)");
    expect(input.style.padding).toBe("var(--space-xs) var(--space-md)");
    expect(screen.getByText("Helper text")).toHaveStyle({
      fontSize: "var(--type-control-large-size)",
      lineHeight: "var(--type-control-large-line-height)",
      fontWeight: "var(--font-weight-control-large)",
    });
  });

  it("switches to the focus state using palette tokens", () => {
    render(<InputField label="Email address" />);
    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");

    fireEvent.focus(input);

    expect(field).toHaveAttribute("data-state", "focus");
    expect(input.style.borderColor).toBe("var(--color-highlight)");

    fireEvent.blur(input);
    expect(field).toHaveAttribute("data-state", "default");
  });

  it("renders the error state using the semantic danger border token", () => {
    render(<InputField label="Email address" error helperText="Invalid email" />);

    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");

    expect(field).toHaveAttribute("data-state", "error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.style.borderColor).toBe("var(--color-danger-border)");
  });

  it("renders the disabled state with the canonical disabled opacity", () => {
    render(<InputField label="Email address" disabled />);

    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");

    expect(input).toBeDisabled();
    expect(field).toHaveAttribute("data-state", "disabled");
    expect(field).toHaveStyle({ opacity: "var(--opacity-disabled)" });
    expect(input.style.background).toBe("var(--color-surface-muted)");
  });
});
