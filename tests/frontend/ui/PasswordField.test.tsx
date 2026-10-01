import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "../../../packages/ui/src/PasswordField";

describe("PasswordField", () => {
  it("renders default, focus, error and disabled states", () => {
    const { rerender } = render(
      <PasswordField label="Password" placeholder="Password" data-testid="password" />,
    );
    const input = screen.getByTestId("password");
    const field = input.closest("[data-component='password-field']");

    expect(field).toHaveAttribute("data-state", "default");
    fireEvent.focus(input);
    expect(field).toHaveAttribute("data-state", "focus");

    rerender(<PasswordField label="Password" error data-testid="password" />);
    expect(field).toHaveAttribute("data-state", "error");

    rerender(<PasswordField label="Password" disabled data-testid="password" />);
    expect(field).toHaveAttribute("data-state", "disabled");
    expect(field).toHaveStyle({ opacity: "var(--opacity-disabled)" });
  });

  it("toggles password visibility on activation", () => {
    render(
      <PasswordField
        label="Password"
        showPasswordLabel="Show password"
        hidePasswordLabel="Hide password"
      />,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const show = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(show);
    expect(input.type).toBe("text");

    const hide = screen.getByRole("button", { name: "Hide password" });
    fireEvent.click(hide);
    expect(input.type).toBe("password");
  });

  it("keeps the selected visibility state across pointer movement", () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(toggle);
    expect(input.type).toBe("text");

    fireEvent.mouseLeave(toggle);
    expect(input.type).toBe("text");
  });
});
