import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InputControl,
  SelectControl,
  TextareaControl,
} from "../../../packages/ui/src/FieldControls";

afterEach(() => {
  cleanup();
});

describe("shared field controls", () => {
  it("applies and clears focus styles for an enabled valid input and forwards focus callbacks", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <InputControl
        aria-label="Name"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Name" });

    fireEvent.focus(input);

    expect(input.style.borderColor).toBe("var(--color-highlight)");
    expect(input.style.boxShadow).toBe("var(--focus-glow)");
    expect(onFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);

    expect(input.style.borderColor).toBe("");
    expect(input.style.boxShadow).toBe("");
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("does not apply focus highlight when the input is invalid", () => {
    render(
      <InputControl
        aria-label="Invalid name"
        variant="error"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Invalid name" });

    expect(input.style.borderColor).toBe("var(--color-danger-border)");
    fireEvent.focus(input);
    expect(input.style.boxShadow).toBe("");
  });

  it("treats aria-invalid boolean and string values as invalid", () => {
    const { rerender } = render(
      <InputControl
        aria-label="Boolean invalid"
        aria-invalid={true}
      />,
    );

    let input = screen.getByRole("textbox", { name: "Boolean invalid" });
    expect(input.style.borderColor).toBe("var(--color-danger-border)");

    rerender(
      <InputControl
        aria-label="String invalid"
        aria-invalid="true"
      />,
    );

    input = screen.getByRole("textbox", { name: "String invalid" });
    expect(input.style.borderColor).toBe("var(--color-danger-border)");
  });

  it("preserves select cursor and focus behavior across enabled and disabled states", () => {
    const onFocus = vi.fn();
    const { rerender } = render(
      <SelectControl
        aria-label="Visibility"
        onFocus={onFocus}
      >
        <option value="private">Private</option>
      </SelectControl>,
    );

    let select = screen.getByRole("combobox", { name: "Visibility" });
    expect(select.style.cursor).toBe("pointer");

    fireEvent.focus(select);
    expect(select.style.borderColor).toBe("var(--color-highlight)");
    expect(select.style.boxShadow).toBe("var(--focus-glow)");
    expect(onFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(select);
    expect(select.style.borderColor).toBe("");
    expect(select.style.boxShadow).toBe("");

    rerender(
      <SelectControl
        aria-label="Visibility"
        disabled
      >
        <option value="private">Private</option>
      </SelectControl>,
    );

    select = screen.getByRole("combobox", { name: "Visibility" });
    expect(select).toBeDisabled();
    expect(select.style.cursor).toBe("not-allowed");

    fireEvent.focus(select);
    expect(select.style.boxShadow).toBe("");
  });

  it("applies disabled and error branches to textarea controls while preserving custom styles", () => {
    render(
      <TextareaControl
        aria-label="Notes"
        disabled
        variant="error"
        style={{ minHeight: "120px" }}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Notes" });

    expect(textarea).toBeDisabled();
    expect(textarea.style.opacity).toBe("0.6");
    expect(textarea.style.cursor).toBe("not-allowed");
    expect(textarea.style.borderColor).toBe("var(--color-danger-border)");
    expect(textarea.style.minHeight).toBe("120px");
  });
});
