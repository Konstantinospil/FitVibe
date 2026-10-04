import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField } from "../../../packages/ui/src/FieldControls";

const options = (
  <>
    <option value="">Choose an option</option>
    <option value="strength">Strength</option>
  </>
);

describe("SelectField", () => {
  it("renders the Figma default state", () => {
    render(
      <SelectField label="Training type" helperText="Helper" defaultValue="">
        {options}
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");

    expect(field).toHaveAttribute("data-state", "default");
    expect(select.style.height).toBe("38px");
    expect(select.style.borderRadius).toBe("var(--radius-md)");
    expect(select.style.borderColor).toBe("var(--color-input-border)");
    expect(screen.getByText("Helper")).toHaveStyle({
      fontSize: "var(--type-control-large-size)",
      lineHeight: "var(--type-control-large-line-height)",
      fontWeight: "var(--font-weight-control-large)",
    });
    expect(field?.querySelector("[data-slot='select-chevron']")).toBeInTheDocument();
  });

  it("switches to focus state using the highlight token", () => {
    render(
      <SelectField label="Training type">
        {options}
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");

    fireEvent.focus(select);

    expect(field).toHaveAttribute("data-state", "focus");
    expect(select.style.borderColor).toBe("var(--color-highlight)");

    fireEvent.blur(select);
    expect(field).toHaveAttribute("data-state", "default");
  });

  it("renders error state and semantic helper styling", () => {
    render(
      <SelectField label="Training type" helperText="Select a training type" error>
        {options}
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");

    expect(field).toHaveAttribute("data-state", "error");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select.style.borderColor).toBe("var(--color-danger-border)");
    expect(screen.getByText("Select a training type")).toHaveStyle({
      color: "var(--color-danger-text)",
    });
  });

  it("renders disabled state with the app opacity and muted surface", () => {
    render(
      <SelectField label="Training type" disabled>
        {options}
      </SelectField>,
    );

    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");

    expect(select).toBeDisabled();
    expect(field).toHaveAttribute("data-state", "disabled");
    expect(field).toHaveStyle({ opacity: "var(--opacity-disabled)" });
    expect(select.style.background).toBe("var(--color-surface-muted)");
  });
});
