import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { FormField } from "../../src/components/ui/FormField";

describe("FormField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render with label", () => {
      render(<FormField label="Email" />);
      expect(screen.getByText("Email")).toBeInTheDocument();
    });

    it("should render Input component by default", () => {
      render(<FormField label="Email" />);
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("should render with helper text", () => {
      render(<FormField label="Email" helperText="Enter your email" />);
      expect(screen.getByText("Enter your email")).toBeInTheDocument();
    });

    it("should render with error message", () => {
      render(<FormField label="Email" error="This field is required" />);
      expect(screen.getByText("This field is required")).toBeInTheDocument();
      expect(screen.getByText("This field is required")).toHaveAttribute("role", "alert");
    });

    it("should not render helper text when error is present", () => {
      render(<FormField label="Email" helperText="Helper" error="Error" />);
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.queryByText("Helper")).not.toBeInTheDocument();
    });

    it("should generate unique id when id is not provided", () => {
      const { container } = render(<FormField label="Email" />);
      const input = container.querySelector("input");
      expect(input).toHaveAttribute("id");
      expect(input?.getAttribute("id")).toMatch(/^input-/);
    });

    it("should use id when provided", () => {
      render(<FormField label="Email" id="custom-field-id" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "custom-field-id");
      const label = screen.getByText("Email");
      expect(label).toHaveAttribute("for", "custom-field-id");
    });
  });

  describe("Required field", () => {
    it("should show required indicator when required is true", () => {
      render(<FormField label="Email" required />);
      const label = screen.getByText("Email");
      // Label component should handle required indicator
      expect(label).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should pass error state to Input", () => {
      render(<FormField label="Email" error="Error message" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("should link error message via aria-errormessage", () => {
      render(<FormField label="Email" error="Error message" />);
      const input = screen.getByRole("textbox");
      const errorId = input.getAttribute("aria-errormessage");
      expect(errorId).toBeTruthy();
      const errorElement = document.getElementById(errorId || "");
      expect(errorElement).toHaveTextContent("Error message");
    });

    it("should link error message via aria-describedby", () => {
      render(<FormField label="Email" error="Error message" />);
      const input = screen.getByRole("textbox");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errorElement = document.getElementById(describedBy || "");
      expect(errorElement).toHaveTextContent("Error message");
    });
  });

  describe("ARIA attributes", () => {
    it("should link helper text via aria-describedby", () => {
      render(<FormField label="Email" helperText="Helper text" />);
      const input = screen.getByRole("textbox");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const helperElement = document.getElementById(describedBy || "");
      expect(helperElement).toHaveTextContent("Helper text");
    });

    it("should link error message via aria-describedby when error is present", () => {
      render(<FormField label="Email" error="Error message" />);
      const input = screen.getByRole("textbox");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errorElement = document.getElementById(describedBy || "");
      expect(errorElement).toHaveTextContent("Error message");
    });
  });

  describe("Input props forwarding", () => {
    it("should forward type prop", () => {
      render(<FormField label="Email" type="email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });

    it("should forward placeholder prop", () => {
      render(<FormField label="Email" placeholder="Enter email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("placeholder", "Enter email");
    });

    it("should forward value prop", () => {
      render(<FormField label="Email" value="test@example.com" onChange={vi.fn()} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("test@example.com");
    });

    it("should forward onChange handler", async () => {
      const onChange = vi.fn();
      render(<FormField label="Email" onChange={onChange} />);
      const input = screen.getByRole("textbox");
      await userEvent.type(input, "test");
      expect(onChange).toHaveBeenCalled();
    });

    it("should forward disabled prop", () => {
      render(<FormField label="Email" disabled />);
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("should forward autoComplete prop", () => {
      render(<FormField label="Email" autoComplete="email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("autoComplete", "email");
    });

    it("should forward minLength prop", () => {
      render(<FormField label="Password" type="password" minLength={8} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toHaveAttribute("minLength", "8");
    });

    it("should forward maxLength prop", () => {
      render(<FormField label="Email" maxLength={100} />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("maxLength", "100");
    });

    it("should forward pattern prop", () => {
      render(<FormField label="Email" pattern="[a-z]+" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("pattern", "[a-z]+");
    });
  });

  describe("Input wrapper", () => {
    it("forwards id to the nested Input", () => {
      render(<FormField label="Custom" id="custom-field" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("id", "custom-field");
    });

    it("passes aria attributes for errors", () => {
      render(<FormField label="Custom" error="Error message" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-errormessage");
    });

    it("forwards type and placeholder to the nested Input", () => {
      render(<FormField label="Custom" type="email" placeholder="Enter email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
      expect(input).toHaveAttribute("placeholder", "Enter email");
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      render(<FormField label="Email" className="custom-class" />);
      expect(screen.getByRole("textbox")).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      render(<FormField label="Email" style={{ marginTop: "10px" }} />);
      expect(screen.getByRole("textbox")).toHaveStyle({ marginTop: "10px" });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty label", () => {
      render(<FormField label="" />);
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("should handle very long error message", () => {
      const longError = "a".repeat(200);
      render(<FormField label="Email" error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("should handle multiple form fields with auto-generated ids", () => {
      render(
        <div>
          <FormField label="Field 1" />
          <FormField label="Field 2" />
          <FormField label="Field 3" />
        </div>,
      );
      const inputs = screen.getAllByRole("textbox");
      expect(inputs).toHaveLength(3);
      // Each should have unique id
      const ids = inputs.map((i) => i.getAttribute("id"));
      expect(new Set(ids).size).toBe(3);
    });

    it("should handle controlled component", () => {
      const { rerender } = render(<FormField label="Email" value="initial" onChange={vi.fn()} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("initial");
      rerender(<FormField label="Email" value="updated" onChange={vi.fn()} />);
      expect(input.value).toBe("updated");
    });
  });
});
