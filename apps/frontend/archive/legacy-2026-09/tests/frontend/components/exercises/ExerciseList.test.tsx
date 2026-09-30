import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExerciseList } from "@/components/exercises/ExerciseList";
import type { Exercise } from "@/services/api";

// Mock dependencies
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.loading": "Loading...",
        "exercises.noExercises": "No exercises found",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@/components/exercises/ExerciseCard", () => ({
  ExerciseCard: ({
    exercise,
    onClick,
    onEdit,
    onDelete,
    onArchive,
    showActions,
  }: {
    exercise: Exercise;
    onClick?: (exerciseId: string) => void;
    onEdit?: (exerciseId: string) => void;
    onDelete?: (exerciseId: string) => void;
    onArchive?: (exerciseId: string) => void;
    showActions?: boolean;
  }) => (
    <div data-testid={`exercise-card-${exercise.id}`}>
      {exercise.name}
      {onClick && <button onClick={() => onClick(exercise.id)}>Click</button>}
      {onEdit && <button onClick={() => onEdit(exercise.id)}>Edit</button>}
      {onDelete && <button onClick={() => onDelete(exercise.id)}>Delete</button>}
      {onArchive && <button onClick={() => onArchive(exercise.id)}>Archive</button>}
    </div>
  ),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/Spinner", () => ({
  Spinner: ({ label }: { label?: string; size?: string }) => (
    <div data-testid="spinner">{label || "Loading"}</div>
  ),
}));

describe("ExerciseList", () => {
  const mockExercises: Exercise[] = [
    {
      id: "exercise-1",
      name: "Bench Press",
      type_code: "strength",
      muscle_group: "Chest",
      owner_id: "user-123",
      is_public: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "exercise-2",
      name: "Squat",
      type_code: "strength",
      muscle_group: "Legs",
      owner_id: "user-123",
      is_public: false,
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render list of exercises", () => {
    render(<ExerciseList exercises={mockExercises} />);

    expect(screen.getByTestId("exercise-card-exercise-1")).toBeInTheDocument();
    expect(screen.getByTestId("exercise-card-exercise-2")).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
  });

  it("should render loading state", () => {
    render(<ExerciseList exercises={[]} loading={true} />);

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-card-exercise-1")).not.toBeInTheDocument();
  });

  it("should render empty state with default message", () => {
    render(<ExerciseList exercises={[]} loading={false} />);

    expect(screen.getByText("No exercises found")).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-card-exercise-1")).not.toBeInTheDocument();
  });

  it("should render empty state with custom message", () => {
    const customMessage = "No exercises available";
    render(<ExerciseList exercises={[]} loading={false} emptyMessage={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it("should pass onClick handler to exercise cards", () => {
    const onExerciseClick = vi.fn();
    render(<ExerciseList exercises={mockExercises} onExerciseClick={onExerciseClick} />);

    const clickButtons = screen.getAllByText("Click");
    expect(clickButtons).toHaveLength(2);
  });

  it("should pass onEdit handler to exercise cards", () => {
    const onExerciseEdit = vi.fn();
    render(<ExerciseList exercises={mockExercises} onExerciseEdit={onExerciseEdit} />);

    const editButtons = screen.getAllByText("Edit");
    expect(editButtons).toHaveLength(2);
  });

  it("should pass onDelete handler to exercise cards", () => {
    const onExerciseDelete = vi.fn();
    render(<ExerciseList exercises={mockExercises} onExerciseDelete={onExerciseDelete} />);

    const deleteButtons = screen.getAllByText("Delete");
    expect(deleteButtons).toHaveLength(2);
  });

  it("should pass onArchive handler to exercise cards", () => {
    const onExerciseArchive = vi.fn();
    render(<ExerciseList exercises={mockExercises} onExerciseArchive={onExerciseArchive} />);

    const archiveButtons = screen.getAllByText("Archive");
    expect(archiveButtons).toHaveLength(2);
  });

  it("should pass showActions prop to exercise cards", () => {
    render(<ExerciseList exercises={mockExercises} showActions={false} onEdit={vi.fn()} />);

    // When showActions is false, action buttons should not be rendered
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("should render in grid layout by default", () => {
    const { container } = render(<ExerciseList exercises={mockExercises} />);

    const listContainer = container.firstChild as HTMLElement;
    expect(listContainer).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    });
  });

  it("should render in list layout when specified", () => {
    const { container } = render(<ExerciseList exercises={mockExercises} layout="list" />);

    const listContainer = container.firstChild as HTMLElement;
    expect(listContainer).toHaveStyle({
      display: "flex",
      flexDirection: "column",
    });
  });

  it("should render in grid layout when specified", () => {
    const { container } = render(<ExerciseList exercises={mockExercises} layout="grid" />);

    const listContainer = container.firstChild as HTMLElement;
    expect(listContainer).toHaveStyle({
      display: "grid",
    });
  });

  it("should handle empty exercises array", () => {
    render(<ExerciseList exercises={[]} loading={false} />);

    expect(screen.getByText("No exercises found")).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-card-exercise-1")).not.toBeInTheDocument();
  });

  it("should render single exercise", () => {
    const singleExercise = [mockExercises[0]];
    render(<ExerciseList exercises={singleExercise} />);

    expect(screen.getByTestId("exercise-card-exercise-1")).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-card-exercise-2")).not.toBeInTheDocument();
  });

  it("should not show loading when loading is false", () => {
    render(<ExerciseList exercises={mockExercises} loading={false} />);

    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    expect(screen.getByTestId("exercise-card-exercise-1")).toBeInTheDocument();
  });

  it("should pass all handlers to exercise cards", () => {
    const handlers = {
      onExerciseClick: vi.fn(),
      onExerciseEdit: vi.fn(),
      onExerciseDelete: vi.fn(),
      onExerciseArchive: vi.fn(),
    };

    render(<ExerciseList exercises={mockExercises} {...handlers} />);

    expect(screen.getAllByText("Click")).toHaveLength(2);
    expect(screen.getAllByText("Edit")).toHaveLength(2);
    expect(screen.getAllByText("Delete")).toHaveLength(2);
    expect(screen.getAllByText("Archive")).toHaveLength(2);
  });
});
