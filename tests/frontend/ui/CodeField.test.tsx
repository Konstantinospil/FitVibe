import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeField } from "../../../packages/ui/src/CodeField";

describe("CodeField", () => {
  it("renders six TOTP slots", () => {
    render(<CodeField label="Enter 6-digit Code" value="" onChange={() => undefined} />);
    const input = screen.getByRole("textbox", { name: "Enter 6-digit Code" });
    const field = input.closest("[data-component='code-field']");

    expect(field).toHaveAttribute("data-mode", "totp");
    expect(field?.querySelectorAll("[data-slot='code-digit']")).toHaveLength(6);
  });

  it("renders focus and error states", () => {
    const { rerender } = render(
      <CodeField label="Enter 6-digit Code" value="120" onChange={() => undefined} />,
    );
    const input = screen.getByRole("textbox", { name: "Enter 6-digit Code" });
    const field = input.closest("[data-component='code-field']");

    fireEvent.focus(input);
    expect(field).toHaveAttribute("data-state", "focus");

    rerender(
      <CodeField
        label="Enter 6-digit Code"
        value="123456"
        onChange={() => undefined}
        error="This code is invalid or has expired"
      />,
    );
    expect(field).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("alert")).toHaveTextContent("This code is invalid or has expired");
  });

  it("renders disabled state", () => {
    render(<CodeField label="Enter 6-digit Code" disabled />);
    const input = screen.getByRole("textbox", { name: "Enter 6-digit Code" });
    const field = input.closest("[data-component='code-field']");

    expect(input).toBeDisabled();
    expect(field).toHaveAttribute("data-state", "disabled");
  });

  it("preserves backup-code mode", () => {
    render(<CodeField label="Enter 6-digit Code" value="ABCD-2345" onChange={() => undefined} />);
    const input = screen.getByRole("textbox", { name: "Enter 6-digit Code" });
    const field = input.closest("[data-component='code-field']");

    expect(field).toHaveAttribute("data-mode", "backup");
    expect(field?.querySelector("[data-slot='backup-code-value']")).toHaveTextContent("ABCD-2345");
  });
});
