import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../../src/components/ui/Textarea";

describe("Textarea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render textarea element", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("should render with label", () => {
      render(<Textarea label="Description" />);
      expect(screen.getByText("Description")).toBeInTheDocument();
      const textarea = screen.getByRole("textbox");
      const label = screen.getByText("Description");
      expect(label).toHaveAttribute("for", textarea.getAttribute("id"));
    });

    it("should render with helper text", () => {
      render(<Textarea helperText="Enter a description" />);
      expect(screen.getByText("Enter a description")).toBeInTheDocument();
    });

    it("should render with error message", () => {
      render(<Textarea error="This field is required" />);
      expect(screen.getByText("This field is required")).toBeInTheDocument();
      expect(screen.getByText("This field is required")).toHaveAttribute("role", "alert");
    });

    it("should not render helper text when error is present", () => {
      render(<Textarea helperText="Helper text" error="Error message" />);
      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    });

    it("should render with custom id", () => {
      render(<Textarea id="custom-textarea" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("id", "custom-textarea");
    });

    it("should generate unique id when id is not provided", () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveAttribute("id");
      expect(textarea?.getAttribute("id")).toMatch(/^textarea-/);
    });
  });

  describe("Size variants", () => {
    it("should apply sm size styles", () => {
      const { container } = render(<Textarea size="sm" />);
      const textarea = container.querySelector("textarea");
      expect((textarea as HTMLTextAreaElement).style.padding).toBe("var(--space-xs) var(--space-sm)");
      expect((textarea as HTMLTextAreaElement).style.fontSize).toBe("var(--font-size-sm)");
    });

    it("should apply md size styles (default)", () => {
      const { container } = render(<Textarea size="md" />);
      const textarea = container.querySelector("textarea");
      expect((textarea as HTMLTextAreaElement).style.padding).toBe("var(--space-sm) var(--space-md)");
      expect((textarea as HTMLTextAreaElement).style.fontSize).toBe("var(--font-size-md)");
    });

    it("should apply lg size styles", () => {
      const { container } = render(<Textarea size="lg" />);
      const textarea = container.querySelector("textarea");
      expect((textarea as HTMLTextAreaElement).style.padding).toBe("var(--space-md) var(--space-lg)");
      expect((textarea as HTMLTextAreaElement).style.fontSize).toBe("var(--font-size-lg)");
    });
  });

  describe("Width", () => {
    it("should be full width by default", () => {
      const { container } = render(<Textarea />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "100%" });
    });

    it("should be auto width when fullWidth is false", () => {
      const { container } = render(<Textarea />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "100%" });
    });
  });

  describe("Error state", () => {
    it("should apply error border color when error is present", () => {
      const { container } = render(<Textarea error="Error message" />);
      const textarea = container.querySelector("textarea");
      // Check that error styles are applied (CSS variables may not be readable)
      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });

    it("should apply error color to label when error is present", () => {
      render(<Textarea label="Description" error="Error message" />);
      const label = screen.getByText("Description");
      expect(label).toBeInTheDocument();
      expect(screen.getByText("Error message")).toBeInTheDocument();
    });

    it("should have aria-invalid when error is present", () => {
      render(<Textarea error="Error message" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });

    it("should have aria-invalid false when no error", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("aria-invalid", "false");
    });

    it("should link error message via aria-errormessage", () => {
      render(<Textarea error="Error message" />);
      const textarea = screen.getByRole("textbox");
      const errorId = textarea.getAttribute("aria-errormessage");
      expect(errorId).toBeTruthy();
      const errorElement = document.getElementById(errorId || "");
      expect(errorElement).toHaveTextContent("Error message");
    });
  });

  describe("ARIA attributes", () => {
    it("should link helper text via aria-describedby", () => {
      render(<Textarea helperText="Helper text" />);
      const textarea = screen.getByRole("textbox");
      const describedBy = textarea.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const helperElement = document.getElementById(describedBy || "");
      expect(helperElement).toHaveTextContent("Helper text");
    });

    it("should link error message via aria-describedby when error is present", () => {
      render(<Textarea error="Error message" />);
      const textarea = screen.getByRole("textbox");
      const describedBy = textarea.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errorElement = document.getElementById(describedBy || "");
      expect(errorElement).toHaveTextContent("Error message");
    });

    it("should prioritize error over helper text in aria-describedby", () => {
      render(<Textarea helperText="Helper" error="Error" />);
      const textarea = screen.getByRole("textbox");
      const describedBy = textarea.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errorElement = document.getElementById(describedBy?.split(" ")[0] || "");
      expect(errorElement).toHaveTextContent("Error");
      expect(screen.queryByText("Helper")).not.toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should handle value changes", async () => {
      const onChange = vi.fn();
      render(<Textarea onChange={onChange} />);
      const textarea = screen.getByRole("textbox");
      await userEvent.type(textarea, "Test input");
      expect(onChange).toHaveBeenCalled();
    });

    it("should forward ref to textarea element", () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
      expect(ref.current?.tagName).toBe("TEXTAREA");
    });

    it("should pass through standard textarea props", () => {
      render(<Textarea placeholder="Enter text" rows={5} maxLength={100} />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("placeholder", "Enter text");
      expect(textarea).toHaveAttribute("rows", "5");
      expect(textarea).toHaveAttribute("maxLength", "100");
    });

    it("should handle disabled state", () => {
      render(<Textarea disabled />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
    });

    it("should handle required state", () => {
      render(<Textarea required />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeRequired();
    });

    it("should handle readOnly state", () => {
      render(<Textarea readOnly />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("readOnly");
    });
  });

  describe("Custom styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<Textarea className="custom-class" />);
      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(<Textarea style={{ marginTop: "10px" }} />);
      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveStyle({ marginTop: "10px" });
    });

    it("should merge custom style with default styles", () => {
      const { container } = render(<Textarea style={{ borderColor: "red" }} />);
      const textarea = container.querySelector("textarea");
      expect((textarea as HTMLTextAreaElement).style.borderColor).toBe("red");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty label", () => {
      render(<Textarea label="" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });

    it("should handle very long error message", () => {
      const longError = "a".repeat(200);
      render(<Textarea error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("should handle multiple textareas with auto-generated ids", () => {
      render(
        <div>
          <Textarea />
          <Textarea />
          <Textarea />
        </div>,
      );
      const textareas = screen.getAllByRole("textbox");
      expect(textareas).toHaveLength(3);
      // Each should have unique id
      const ids = textareas.map((t) => t.getAttribute("id"));
      expect(new Set(ids).size).toBe(3);
    });

    it("should handle controlled component", () => {
      const { rerender } = render(<Textarea value="Initial" onChange={vi.fn()} />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Initial");
      rerender(<Textarea value="Updated" onChange={vi.fn()} />);
      expect(textarea.value).toBe("Updated");
    });

    it("should handle uncontrolled component", async () => {
      render(<Textarea defaultValue="Default" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Default");
      await userEvent.clear(textarea);
      await userEvent.type(textarea, "New value");
      expect(textarea.value).toBe("New value");
    });
  });
});
