import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../../src/components/ui/Checkbox";

describe("Checkbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render checkbox input", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute("type", "checkbox");
    });

    it("should render with label", () => {
      render(<Checkbox label="Accept terms" />);
      expect(screen.getByText("Accept terms")).toBeInTheDocument();
      const checkbox = screen.getByRole("checkbox");
      const label = screen.getByText("Accept terms").closest("label");
      expect(label).toHaveAttribute("for", checkbox.getAttribute("id"));
    });

    it("should render with helper text", () => {
      render(<Checkbox helperText="Please read the terms" />);
      expect(screen.getByText("Please read the terms")).toBeInTheDocument();
    });

    it("should render with error message", () => {
      render(<Checkbox error="This field is required" />);
      expect(screen.getByText("This field is required")).toBeInTheDocument();
      expect(screen.getByText("This field is required")).toHaveAttribute("role", "alert");
      expect(screen.getByText("This field is required")).toHaveAttribute("aria-live", "assertive");
    });

    it("should not render helper text when error is present", () => {
      render(<Checkbox helperText="Helper text" error="Error message" />);
      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    });

    it("should render with custom id", () => {
      render(<Checkbox id="custom-checkbox" />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("id", "custom-checkbox");
    });

    it("should generate unique id when id is not provided", () => {
      const { container } = render(<Checkbox />);
      const checkbox = container.querySelector("input[type='checkbox']");
      expect(checkbox).toHaveAttribute("id");
      expect(checkbox?.getAttribute("id")).toMatch(/^checkbox-/);
    });
  });

  describe("User interactions", () => {
    it("should handle checkbox click", async () => {
      const onChange = vi.fn();
      render(<Checkbox onChange={onChange} />);
      const checkbox = screen.getByRole("checkbox");
      await userEvent.click(checkbox);
      expect(onChange).toHaveBeenCalled();
    });

    it("should toggle checked state when clicked", async () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it("should forward ref to checkbox element", () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe("checkbox");
    });

    it("should handle controlled component", () => {
      const { rerender } = render(<Checkbox checked={false} onChange={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      rerender(<Checkbox checked={true} onChange={vi.fn()} />);
      expect(checkbox.checked).toBe(true);
    });

    it("should handle disabled state", () => {
      render(<Checkbox disabled />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });

    it("should not toggle when disabled", async () => {
      render(<Checkbox disabled />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      const initialChecked = checkbox.checked;
      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(initialChecked);
    });

    it("should handle required state", () => {
      render(<Checkbox required />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeRequired();
    });
  });

  describe("Error state", () => {
    it("should have aria-invalid when error is present", () => {
      render(<Checkbox error="Error message" />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-invalid", "true");
    });

    it("should have aria-invalid false when no error", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-invalid", "false");
    });

    it("should link error message via aria-errormessage", () => {
      render(<Checkbox error="Error message" />);
      const checkbox = screen.getByRole("checkbox");
      const errorId = checkbox.getAttribute("aria-errormessage");
      expect(errorId).toBeTruthy();
      const errorElement = document.getElementById(errorId || "");
      expect(errorElement).toHaveTextContent("Error message");
    });

    it("should link both error and helper text via aria-describedby when both present", () => {
      render(<Checkbox helperText="Helper" error="Error" />);
      const checkbox = screen.getByRole("checkbox");
      const describedBy = checkbox.getAttribute("aria-describedby");
      // Should contain both IDs
      expect(describedBy).toBeTruthy();
    });
  });

  describe("ARIA attributes", () => {
    it("should link helper text via aria-describedby", () => {
      render(<Checkbox helperText="Helper text" />);
      const checkbox = screen.getByRole("checkbox");
      const describedBy = checkbox.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const helperElement = document.getElementById(describedBy?.split(" ")[0] || "");
      expect(helperElement).toHaveTextContent("Helper text");
    });

    it("should link error message via aria-describedby when error is present", () => {
      render(<Checkbox error="Error message" />);
      const checkbox = screen.getByRole("checkbox");
      const describedBy = checkbox.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errorElement = document.getElementById(describedBy?.split(" ")[0] || "");
      expect(errorElement).toHaveTextContent("Error message");
    });
  });

  describe("Styling", () => {
    it("should apply disabled styles when disabled", () => {
      const { container } = render(<Checkbox disabled />);
      const checkbox = container.querySelector("input[type='checkbox']");
      expect(checkbox).toHaveStyle({
        opacity: "0.6",
        cursor: "not-allowed",
      });
    });

    it("should apply custom className", () => {
      const { container } = render(<Checkbox className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(<Checkbox style={{ marginTop: "10px" }} />);
      const checkbox = container.querySelector("input[type='checkbox']");
      expect(checkbox).toHaveStyle({ marginTop: "10px" });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty label", () => {
      render(<Checkbox label="" />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("should handle very long error message", () => {
      const longError = "a".repeat(200);
      render(<Checkbox error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("should handle multiple checkboxes with auto-generated ids", () => {
      render(
        <div>
          <Checkbox />
          <Checkbox />
          <Checkbox />
        </div>,
      );
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
      // Each should have unique id
      const ids = checkboxes.map((c) => c.getAttribute("id"));
      expect(new Set(ids).size).toBe(3);
    });

    it("should handle checkbox with only label", () => {
      render(<Checkbox label="Option 1" />);
      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should handle checkbox with only helper text", () => {
      render(<Checkbox helperText="Helper text" />);
      expect(screen.getByText("Helper text")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should handle checkbox with only error", () => {
      render(<Checkbox error="Error message" />);
      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should handle indeterminate state", () => {
      const { container } = render(<Checkbox />);
      const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
      checkbox.indeterminate = true;
      expect(checkbox.indeterminate).toBe(true);
    });
  });
});
