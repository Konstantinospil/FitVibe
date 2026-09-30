import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExerciseFilters } from "@/components/exercises/ExerciseFilters";

// Mock dependencies
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "exercises.searchLabel": "Search",
        "exercises.searchPlaceholder": "Search exercises...",
        "exercises.filterType": "Type",
        "exercises.allTypes": "All Types",
        "exercises.type.strength": "Strength",
        "exercises.type.cardio": "Cardio",
        "exercises.type.powerEndurance": "Power Endurance",
        "exercises.showArchived": "Show Archived",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

vi.mock("@/components/ui", () => ({
  FormField: ({
    label,
    value,
    onChange,
    placeholder,
    type,
    size,
  }: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    size?: string;
  }) => (
    <div>
      <label>{label}</label>
      <input
        data-testid="search-input"
        type={type || "text"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        data-size={size}
      />
    </div>
  ),
}));

describe("ExerciseFilters", () => {
  const defaultProps = {
    searchQuery: "",
    type: "all" as const,
    showArchived: false,
    onSearchChange: vi.fn(),
    onTypeChange: vi.fn(),
    onShowArchivedChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    render(<ExerciseFilters {...defaultProps} />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("should render search input with placeholder", () => {
    render(<ExerciseFilters {...defaultProps} />);

    const searchInput = screen.getByTestId("search-input");
    expect(searchInput).toHaveAttribute("placeholder", "Search exercises...");
  });

  it("should display current search query", () => {
    render(<ExerciseFilters {...defaultProps} searchQuery="bench press" />);

    const searchInput = screen.getByTestId("search-input");
    expect(searchInput).toHaveValue("bench press");
  });

  it("should call onSearchChange when search input changes", () => {
    const onSearchChange = vi.fn();
    render(<ExerciseFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "squat" } });

    expect(onSearchChange).toHaveBeenCalledWith("squat");
  });

  it("should render type filter select", () => {
    const { container } = render(<ExerciseFilters {...defaultProps} />);

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect.tagName).toBe("SELECT");
  });

  it("should display current type filter", () => {
    const { container } = render(<ExerciseFilters {...defaultProps} type="strength" />);

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    expect(typeSelect.value).toBe("strength");
  });

  it("should call onTypeChange when type filter changes", () => {
    const onTypeChange = vi.fn();
    const { container } = render(<ExerciseFilters {...defaultProps} onTypeChange={onTypeChange} />);

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "cardio" } });

    expect(onTypeChange).toHaveBeenCalledWith("cardio");
  });

  it("should render all type options", () => {
    const { container } = render(<ExerciseFilters {...defaultProps} />);

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    const options = Array.from(typeSelect.options).map((opt) => opt.value);

    expect(options).toContain("all");
    expect(options).toContain("strength");
    expect(options).toContain("cardio");
    expect(options).toContain("powerEndurance");
  });

  it("should render show archived checkbox", () => {
    render(<ExerciseFilters {...defaultProps} />);

    const checkbox = screen.getByLabelText("Show Archived");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });

  it("should display current archived filter state", () => {
    render(<ExerciseFilters {...defaultProps} showArchived={true} />);

    const checkbox = screen.getByLabelText("Show Archived") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("should call onShowArchivedChange when checkbox is toggled", () => {
    const onShowArchivedChange = vi.fn();
    render(<ExerciseFilters {...defaultProps} onShowArchivedChange={onShowArchivedChange} />);

    const checkbox = screen.getByLabelText("Show Archived");
    fireEvent.click(checkbox);

    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });

  it("should handle type filter change to all", () => {
    const onTypeChange = vi.fn();
    const { container } = render(
      <ExerciseFilters {...defaultProps} type="strength" onTypeChange={onTypeChange} />,
    );

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "all" } });

    expect(onTypeChange).toHaveBeenCalledWith("all");
  });

  it("should handle type filter change to powerEndurance", () => {
    const onTypeChange = vi.fn();
    const { container } = render(<ExerciseFilters {...defaultProps} onTypeChange={onTypeChange} />);

    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "powerEndurance" } });

    expect(onTypeChange).toHaveBeenCalledWith("powerEndurance");
  });

  it("should handle multiple filter changes", () => {
    const onSearchChange = vi.fn();
    const onTypeChange = vi.fn();
    const onShowArchivedChange = vi.fn();

    const { container } = render(
      <ExerciseFilters
        {...defaultProps}
        onSearchChange={onSearchChange}
        onTypeChange={onTypeChange}
        onShowArchivedChange={onShowArchivedChange}
      />,
    );

    const searchInput = screen.getByTestId("search-input");
    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    const checkbox = screen.getByLabelText("Show Archived");

    fireEvent.change(searchInput, { target: { value: "test" } });
    fireEvent.change(typeSelect, { target: { value: "cardio" } });
    fireEvent.click(checkbox);

    expect(onSearchChange).toHaveBeenCalledWith("test");
    expect(onTypeChange).toHaveBeenCalledWith("cardio");
    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });

  it("should render all filter elements", () => {
    const { container } = render(<ExerciseFilters {...defaultProps} />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(container.querySelector("select")).toBeInTheDocument();
    expect(screen.getByLabelText("Show Archived")).toBeInTheDocument();
  });

  it("should handle empty search query", () => {
    const onSearchChange = vi.fn();
    render(<ExerciseFilters {...defaultProps} searchQuery="" onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId("search-input");
    expect(searchInput).toHaveValue("");
  });

  it("should handle archived checkbox uncheck", () => {
    const onShowArchivedChange = vi.fn();
    render(
      <ExerciseFilters
        {...defaultProps}
        showArchived={true}
        onShowArchivedChange={onShowArchivedChange}
      />,
    );

    const checkbox = screen.getByLabelText("Show Archived");
    fireEvent.click(checkbox);

    expect(onShowArchivedChange).toHaveBeenCalledWith(false);
  });
});
