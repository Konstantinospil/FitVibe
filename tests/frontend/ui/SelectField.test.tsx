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
  it("renders the default design-system state", () => {
    render(
      <SelectField label="Training type" helperText="Helper" defaultValue="">
        {options}
      </SelectField>,
    );
    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");
    expect(field).toHaveAttribute("data-state", "default");
    expect(select).toHaveAttribute("data-component", "select-control");
    expect(select).toHaveAttribute("data-size", "md");
    expect(select).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("Helper")).toHaveAttribute("data-slot", "field-helper");
    expect(field?.querySelector("[data-slot='select-chevron']")).toBeInTheDocument();
  });

  it("switches to focus state", () => {
    render(<SelectField label="Training type">{options}</SelectField>);
    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");
    fireEvent.focus(select);
    expect(field).toHaveAttribute("data-state", "focus");
    fireEvent.blur(select);
    expect(field).toHaveAttribute("data-state", "default");
  });

  it("renders error state and semantic helper structure", () => {
    render(
      <SelectField label="Training type" helperText="Select a training type" error>
        {options}
      </SelectField>,
    );
    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");
    expect(field).toHaveAttribute("data-state", "error");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("data-variant", "error");
    expect(screen.getByText("Select a training type")).toHaveAttribute("data-slot", "field-helper");
  });

  it("renders disabled state", () => {
    render(
      <SelectField label="Training type" disabled>
        {options}
      </SelectField>,
    );
    const select = screen.getByRole("combobox", { name: "Training type" });
    const field = select.closest("[data-component='select-field']");
    expect(select).toBeDisabled();
    expect(field).toHaveAttribute("data-state", "disabled");
  });
});
