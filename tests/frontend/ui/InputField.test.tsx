import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputField } from "../../../packages/ui/src/FieldControls";

describe("InputField", () => {
  it("renders the default design-system state", () => {
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
    expect(input).toHaveAttribute("data-component", "input-control");
    expect(input).toHaveAttribute("data-size", "md");
    expect(input).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("Helper text")).toHaveAttribute("data-slot", "field-helper");
  });

  it("switches to the focus state", () => {
    render(<InputField label="Email address" />);
    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");
    fireEvent.focus(input);
    expect(field).toHaveAttribute("data-state", "focus");
    fireEvent.blur(input);
    expect(field).toHaveAttribute("data-state", "default");
  });

  it("renders the error state with accessible semantics", () => {
    render(<InputField label="Email address" error helperText="Invalid email" />);
    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");
    expect(field).toHaveAttribute("data-state", "error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("data-variant", "error");
  });

  it("renders the disabled state", () => {
    render(<InputField label="Email address" disabled />);
    const input = screen.getByRole("textbox", { name: "Email address" });
    const field = input.closest("[data-component='input-field']");
    expect(input).toBeDisabled();
    expect(field).toHaveAttribute("data-state", "disabled");
  });
});
