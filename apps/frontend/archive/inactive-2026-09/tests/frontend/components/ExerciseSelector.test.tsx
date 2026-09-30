import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ExerciseSelector } from "../../src/components/ExerciseSelector";
import { listExercises } from "../../src/services/api";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Mock API
vi.mock("../../src/services/api", () => ({
  listExercises: vi.fn(),
}));

const mockListExercises = vi.mocked(listExercises);

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      common: {
        exercises: {
          selectExercise: "Select exercise",
          clearSelection: "Clear selection",
          searchPlaceholder: "Search exercises...",
          searchLabel: "Search exercises",
          noResults: "No exercises found",
          noExercises: "No exercises available",
          global: "Global",
          public: "Public",
        },
        loading: "Loading...",
      },
    },
  },
});

const mockExercises = [
  {
    id: "ex-1",
    name: "Bench Press",
    type_code: "strength",
    owner_id: "user-1",
    muscle_group: "chest",
    equipment: "barbell",
    tags: ["chest", "strength"],
    is_public: false,
    description_en: "Classic bench press",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    archived_at: null,
  },
  {
    id: "ex-2",
    name: "Running",
    type_code: "cardio",
    owner_id: null, // Global exercise
    muscle_group: "legs",
    equipment: null,
    tags: ["cardio", "endurance"],
    is_public: true,
    description_en: "Running exercise",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    archived_at: null,
  },
  {
    id: "ex-3",
    name: "Public Squat",
    type_code: "strength",
    owner_id: "user-2",
    muscle_group: "legs",
    equipment: "barbell",
    tags: ["legs", "strength"],
    is_public: true,
    description_en: "Public squat exercise",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    archived_at: null,
  },
];

const renderComponent = (props = {}) => {
  const defaultProps = {
    onChange: vi.fn(),
    ...props,
  };

  return render(
    <I18nextProvider i18n={testI18n}>
      <ExerciseSelector {...defaultProps} />
    </I18nextProvider>,
  );
};

describe("ExerciseSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListExercises.mockResolvedValue({
      data: mockExercises,
      total: mockExercises.length,
      limit: 100,
      offset: 0,
    });
  });

  it("renders with placeholder", () => {
    renderComponent();
    expect(screen.getByText("Select exercise")).toBeInTheDocument();
  });

  it("opens dropdown when clicked", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText("Search exercises...")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("loads and displays exercises when dropdown opens", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByText("Bench Press")).toBeInTheDocument();
        expect(screen.getByText("Running")).toBeInTheDocument();
        expect(screen.getByText("Public Squat")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(mockListExercises).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      include_archived: false, // excludeArchived defaults to true, so include_archived should be false
    });
  });

  it("filters exercises by search query", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText("Search exercises...")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const searchInput = screen.getByPlaceholderText("Search exercises...");
    fireEvent.change(searchInput, { target: { value: "bench" } });

    await waitFor(
      () => {
        expect(mockListExercises).toHaveBeenCalledWith(
          expect.objectContaining({
            q: "bench",
          }),
        );
      },
      { timeout: 5000 },
    );
  });

  it("calls onChange when exercise is selected", async () => {
    const onChange = vi.fn();
    renderComponent({ onChange });
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    const benchPress = screen.getByText("Bench Press");
    fireEvent.click(benchPress);

    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith("ex-1", mockExercises[0]);
      },
      { timeout: 5000 },
    );
  });

  it("displays selected exercise name", async () => {
    const onChange = vi.fn();
    renderComponent({ value: "ex-1", onChange });
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByText("Bench Press")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Selected exercise should be highlighted - use getAllByText to find the one in the list
    const benchPressElements = screen.getAllByText("Bench Press");
    const benchPressItem = benchPressElements
      .map((el) => el.closest("li"))
      .find((li) => li !== null);
    expect(benchPressItem).toHaveAttribute("aria-selected", "true");
  });

  it("clears selection when clear button is clicked", async () => {
    const onChange = vi.fn();
    renderComponent({ value: "ex-1", onChange });

    // Open dropdown to load exercises so selectedExercise is set
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    // Wait for exercises to load
    await waitFor(
      () => {
        expect(screen.getByText("Bench Press")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Close dropdown - clear button should now be visible in trigger
    fireEvent.click(trigger);

    // Wait for clear button to appear
    await waitFor(
      () => {
        const clearButton = screen.getByRole("button", { name: /clear selection/i });
        expect(clearButton).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const clearButton = screen.getByRole("button", { name: /clear selection/i });
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it("displays global exercise badge", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByText("Running")).toBeInTheDocument();
        expect(screen.getByText("Global")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays public exercise badge", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByText("Public Squat")).toBeInTheDocument();
        expect(screen.getAllByText("Public")[0]).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("filters by type_code when provided", async () => {
    renderComponent({ filterByType: "strength" });
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(mockListExercises).toHaveBeenCalledWith(
          expect.objectContaining({
            type_code: "strength",
          }),
        );
      },
      { timeout: 5000 },
    );
  });

  it("filters by muscle_group when provided", async () => {
    renderComponent({ filterByMuscleGroup: "chest" });
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockListExercises).toHaveBeenCalledWith(
        expect.objectContaining({
          muscle_group: "chest",
        }),
      );
    });
  });

  it("excludes archived exercises by default", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(mockListExercises).toHaveBeenCalledWith(
          expect.objectContaining({
            include_archived: false, // excludeArchived defaults to true, so include_archived should be false
          }),
        );
      },
      { timeout: 5000 },
    );
  });

  it("shows loading state while fetching", async () => {
    mockListExercises.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: [], total: 0, limit: 100, offset: 0 }), 100);
        }),
    );

    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows no results message when search returns empty", async () => {
    mockListExercises.mockResolvedValue({
      data: [],
      total: 0,
      limit: 100,
      offset: 0,
    });

    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("No exercises available")).toBeInTheDocument();
    });
  });

  it("closes dropdown when clicking outside", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText("Search exercises...")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(
      () => {
        expect(screen.queryByPlaceholderText("Search exercises...")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("is disabled when disabled prop is true", () => {
    renderComponent({ disabled: true });
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    expect(trigger).toBeDisabled();
  });

  it("displays custom placeholder", () => {
    renderComponent({ placeholder: "Choose an exercise" });
    expect(screen.getByText("Choose an exercise")).toBeInTheDocument();
  });

  it("displays muscle group information", async () => {
    renderComponent();
    const trigger = screen.getByRole("button", { name: /select exercise/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("chest")).toBeInTheDocument();
    });
  });
});
