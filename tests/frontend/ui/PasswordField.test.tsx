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

  it("reveals only while the visibility control is held", () => {
    render(
      <PasswordField
        label="Password"
        showPasswordLabel="Show password"
        hidePasswordLabel="Hide password"
      />,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const show = screen.getByRole("button", { name: "Show password" });

    fireEvent.mouseDown(show);
    expect(input.type).toBe("text");

    const hide = screen.getByRole("button", { name: "Hide password" });
    fireEvent.mouseUp(hide);
    expect(input.type).toBe("password");
  });

  it("masks on mouse leave and touch end", () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });

    fireEvent.mouseDown(toggle);
    expect(input.type).toBe("text");
    fireEvent.mouseLeave(toggle);
    expect(input.type).toBe("password");

    fireEvent.touchStart(toggle);
    expect(input.type).toBe("text");
    fireEvent.touchEnd(toggle);
    expect(input.type).toBe("password");
  });
});
