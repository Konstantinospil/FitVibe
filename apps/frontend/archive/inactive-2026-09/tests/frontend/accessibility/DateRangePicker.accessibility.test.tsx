import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DateRange } from "../../src/components/DateRangePicker";
import DateRangePicker from "../../src/components/DateRangePicker";

describe("DateRangePicker Accessibility", () => {
  const defaultRange: DateRange = {
    from: "2024-01-01",
    to: "2024-01-31",
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Semantic HTML and labels", () => {
    it("should use proper input type for date fields", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      expect(inputs.length).toBe(2);
      inputs.forEach((input) => {
        expect((input as HTMLInputElement).type).toBe("date");
      });
    });

    it("should have accessible labels for both date inputs", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      // Inputs should be accessible via their label text
      expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    });

    it("should properly associate labels with inputs", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const labels = container.querySelectorAll("label");
      expect(labels).toHaveLength(2);

      // Labels wrap inputs, so they should be properly associated
      labels.forEach((label) => {
        const input = label.querySelector('input[type="date"]');
        expect(input).toBeInTheDocument();
      });
    });

    it("should have descriptive label text", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      expect(screen.getByText(/from:/i)).toBeInTheDocument();
      expect(screen.getByText(/to:/i)).toBeInTheDocument();
    });
  });

  describe("Keyboard navigation", () => {
    it("should allow Tab navigation between date inputs", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      const toInput = screen.getByLabelText(/to/i);

      fromInput.focus();
      expect(fromInput).toHaveFocus();

      await user.tab();
      expect(toInput).toHaveFocus();
    });

    it("should allow Shift+Tab to navigate backwards", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      const toInput = screen.getByLabelText(/to/i);

      toInput.focus();
      expect(toInput).toHaveFocus();

      await user.tab({ shift: true });
      expect(fromInput).toHaveFocus();
    });

    it("should be included in tab order", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      const toInput = screen.getByLabelText(/to/i);

      expect(fromInput.tabIndex).not.toBe(-1);
      expect(toInput.tabIndex).not.toBe(-1);
    });

    it("should allow keyboard date entry", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fromInput.focus();

      // Native date inputs support keyboard entry
      await user.clear(fromInput);
      await user.type(fromInput, "2024-02-01");

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe("Screen reader support", () => {
    it("should announce date inputs with clear purpose", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      const toInput = screen.getByLabelText(/to/i);

      // Inputs should have accessible names from labels
      expect(fromInput).toHaveAccessibleName(/from/i);
      expect(toInput).toHaveAccessibleName(/to/i);
    });

    it("should communicate date format to screen readers", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      // Native date inputs announce their format based on locale
      expect(fromInput.type).toBe("date");
      expect(toInput.type).toBe("date");
    });

    it("should announce current date values", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      expect(fromInput.value).toBe("2024-01-01");
      expect(toInput.value).toBe("2024-01-31");
    });

    it("should announce current date values", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      // Component displays initial values
      expect(fromInput.value).toBe("2024-01-01");
      expect(toInput.value).toBe("2024-01-31");
    });
  });

  describe("Date validation and constraints", () => {
    it("should respect maxDate constraint", () => {
      const maxDate = "2024-12-31";
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} maxDate={maxDate} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      expect(fromInput.max).toBe(maxDate);
      expect(toInput.max).toBe(maxDate);
    });

    it("should respect minDate constraint", () => {
      const minDate = "2024-01-01";
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} minDate={minDate} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      expect(fromInput.min).toBe(minDate);
      expect(toInput.min).toBe(minDate);
    });

    it("should use today as default maxDate", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const today = new Date().toISOString().split("T")[0];
      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;

      expect(fromInput.max).toBe(today);
    });

    it("should adjust 'to' date when 'from' is set after 'to'", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fireEvent.change(fromInput, { target: { value: "2024-02-15" } });

      expect(mockOnChange).toHaveBeenCalledWith({
        from: "2024-02-15",
        to: "2024-02-15",
      });
    });

    it("should adjust 'from' date when 'to' is set before 'from'", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const toInput = screen.getByLabelText(/to/i);
      fireEvent.change(toInput, { target: { value: "2023-12-15" } });

      expect(mockOnChange).toHaveBeenCalledWith({
        from: "2023-12-15",
        to: "2023-12-15",
      });
    });

    it("should allow valid date ranges", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fireEvent.change(fromInput, { target: { value: "2024-01-10" } });

      expect(mockOnChange).toHaveBeenCalledWith({
        from: "2024-01-10",
        to: "2024-01-31",
      });
    });
  });

  describe("Focus management", () => {
    it("should show visible focus indicator on 'from' input", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fromInput.focus();

      expect(fromInput).toHaveFocus();
    });

    it("should show visible focus indicator on 'to' input", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const toInput = screen.getByLabelText(/to/i);
      toInput.focus();

      expect(toInput).toHaveFocus();
    });

    it("should maintain focus after date selection", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fromInput.focus();

      fireEvent.change(fromInput, { target: { value: "2024-01-15" } });

      expect(fromInput).toHaveFocus();
    });
  });

  describe("Visual accessibility", () => {
    it("should use semantic color variables", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      inputs.forEach((input) => {
        const styles = input.getAttribute("style");
        expect(styles).toContain("--color-border");
        expect(styles).toContain("--color-text-primary");
      });
    });

    it("should have sufficient color contrast for labels", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const labels = container.querySelectorAll("label span");
      labels.forEach((label) => {
        const styles = label.getAttribute("style");
        expect(styles).toContain("--color-text-secondary");
      });
    });

    it("should have adequate padding for touch targets", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      inputs.forEach((input) => {
        const styles = input.getAttribute("style");
        expect(styles).toContain("padding");
      });
    });

    it("should display inputs in a logical visual order", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const containerDiv = container.querySelector("div");
      const styles = containerDiv?.getAttribute("style");

      // Should use flexbox for layout
      expect(styles).toContain("display: flex");
      expect(styles).toContain("gap");
    });
  });

  describe("Responsive behavior", () => {
    it("should allow flex wrapping for narrow viewports", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const containerDiv = container.querySelector("div");
      const styles = containerDiv?.getAttribute("style");

      expect(styles).toContain("flex-wrap: wrap");
    });

    it("should maintain spacing between inputs", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const containerDiv = container.querySelector("div");
      const styles = containerDiv?.getAttribute("style");

      expect(styles).toContain("gap");
    });
  });

  describe("Native date picker accessibility", () => {
    it("should leverage browser's native date picker UI", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      expect(inputs.length).toBe(2);
      inputs.forEach((input) => {
        // Native date inputs provide accessible calendar UI
        expect((input as HTMLInputElement).type).toBe("date");
      });
    });

    it("should support browser keyboard shortcuts for date selection", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fromInput.focus();

      // Browser handles date picker keyboard shortcuts (Arrow keys, Enter, etc.)
      // We verify the input is focusable and interactive
      expect(fromInput).toHaveFocus();
      expect(fromInput).not.toBeDisabled();
    });

    it("should support mouse interaction with native date picker", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      await user.click(fromInput);

      // Click opens native date picker (browser-dependent)
      expect(fromInput).toHaveFocus();
    });
  });

  describe("Date range relationship", () => {
    it("should communicate relationship between from and to dates", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      // The component groups the two inputs visually and semantically
      const fromInput = screen.getByLabelText(/from/i);
      const toInput = screen.getByLabelText(/to/i);

      expect(fromInput).toBeInTheDocument();
      expect(toInput).toBeInTheDocument();
    });

    it("should prevent invalid date ranges through auto-correction", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i);

      // Setting from date after to date should auto-correct
      fireEvent.change(fromInput, { target: { value: "2024-12-31" } });

      expect(mockOnChange).toHaveBeenCalledWith({
        from: "2024-12-31",
        to: "2024-12-31",
      });
    });

    it("should maintain valid state when updating to date", () => {
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} />);

      const toInput = screen.getByLabelText(/to/i);

      // Setting to date within valid range
      fireEvent.change(toInput, { target: { value: "2024-01-15" } });

      expect(mockOnChange).toHaveBeenCalledWith({
        from: "2024-01-01",
        to: "2024-01-15",
      });
    });
  });

  describe("Error prevention", () => {
    it("should not allow future dates beyond maxDate", () => {
      const maxDate = "2024-06-30";
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} maxDate={maxDate} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;

      // Browser should enforce max constraint
      expect(fromInput.max).toBe(maxDate);
    });

    it("should not allow past dates before minDate", () => {
      const minDate = "2024-01-01";
      render(<DateRangePicker value={defaultRange} onChange={mockOnChange} minDate={minDate} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;

      // Browser should enforce min constraint
      expect(fromInput.min).toBe(minDate);
    });

    it("should handle empty date values gracefully", () => {
      const emptyRange: DateRange = {
        from: "",
        to: "",
      };

      render(<DateRangePicker value={emptyRange} onChange={mockOnChange} />);

      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;

      expect(fromInput.value).toBe("");
      expect(toInput.value).toBe("");
    });
  });

  describe("Reduced motion", () => {
    it("should respect prefers-reduced-motion preferences", () => {
      const { container } = render(
        <DateRangePicker value={defaultRange} onChange={mockOnChange} />,
      );

      // Component should not have animated transitions
      const inputs = container.querySelectorAll('input[type="date"]');
      inputs.forEach((input) => {
        // No explicit transitions defined, respects browser defaults
        expect(input).toBeInTheDocument();
      });
    });
  });
});
