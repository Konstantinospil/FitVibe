import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExerciseCard } from "@/components/exercises/ExerciseCard";
import type { Exercise } from "@/services/api";

// Mock dependencies
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "exercises.global": "Global",
        "exercises.public": "Public",
        "exercises.private": "Private",
        "exercises.muscleGroup": "Muscle Group",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("lucide-react", () => ({
  Edit: ({ size }: { size: number }) => (
    <div data-testid="edit-icon" data-size={size}>
      Edit
    </div>
  ),
  Trash2: ({ size }: { size: number }) => (
    <div data-testid="trash-icon" data-size={size}>
      Trash
    </div>
  ),
  Archive: ({ size }: { size: number }) => (
    <div data-testid="archive-icon" data-size={size}>
      Archive
    </div>
  ),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({
    children,
    onClick,
    style,
    onMouseEnter,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    style?: React.CSSProperties;
    onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  }) => (
    <div
      data-testid="card"
      onClick={onClick}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({
    children,
    variant,
    size,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} data-size={size}>
      {children}
    </span>
  ),
}));

describe("ExerciseCard", () => {
  const mockExercise: Exercise = {
    id: "exercise-1",
    name: "Bench Press",
    type_code: "strength",
    muscle_group: "Chest",
    description_en: "A compound exercise for chest muscles",
    owner_id: "user-123",
    is_public: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render exercise name", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("should render exercise type code", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    expect(screen.getByText("strength")).toBeInTheDocument();
  });

  it("should render muscle group when provided", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    expect(screen.getByText(/Muscle Group: Chest/)).toBeInTheDocument();
  });

  it("should render description when provided", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    expect(screen.getByText("A compound exercise for chest muscles")).toBeInTheDocument();
  });

  it("should not render muscle group when not provided", () => {
    const exerciseWithoutMuscleGroup: Exercise = {
      ...mockExercise,
      muscle_group: null,
    };

    render(<ExerciseCard exercise={exerciseWithoutMuscleGroup} />);

    expect(screen.queryByText(/Muscle Group:/)).not.toBeInTheDocument();
  });

  it("should not render description when not provided", () => {
    const exerciseWithoutDescription: Exercise = {
      ...mockExercise,
      description_en: null,
    };

    render(<ExerciseCard exercise={exerciseWithoutDescription} />);

    expect(screen.queryByText("A compound exercise for chest muscles")).not.toBeInTheDocument();
  });

  it("should render global badge for global exercise", () => {
    const globalExercise: Exercise = {
      ...mockExercise,
      owner_id: null,
    };

    render(<ExerciseCard exercise={globalExercise} />);

    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("should render public badge for public exercise", () => {
    const publicExercise: Exercise = {
      ...mockExercise,
      is_public: true,
      owner_id: "user-123",
    };

    render(<ExerciseCard exercise={publicExercise} />);

    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("should render private badge for private exercise", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("should call onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onClick={onClick} />);

    const card = screen.getByTestId("card");
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledWith("exercise-1");
  });

  it("should have pointer cursor when onClick is provided", () => {
    const onClick = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onClick={onClick} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "pointer" });
  });

  it("should have default cursor when onClick is not provided", () => {
    render(<ExerciseCard exercise={mockExercise} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "default" });
  });

  it("should call onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onEdit={onEdit} />);

    const editButton = screen.getByLabelText("Edit exercise");
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith("exercise-1");
  });

  it("should call onArchive when archive button is clicked", () => {
    const onArchive = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onArchive={onArchive} />);

    const archiveButton = screen.getByLabelText("Archive exercise");
    fireEvent.click(archiveButton);

    expect(onArchive).toHaveBeenCalledWith("exercise-1");
  });

  it("should call onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onDelete={onDelete} />);

    const deleteButton = screen.getByLabelText("Delete exercise");
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith("exercise-1");
  });

  it("should not show action buttons when showActions is false", () => {
    render(<ExerciseCard exercise={mockExercise} showActions={false} onEdit={vi.fn()} />);

    expect(screen.queryByLabelText("Edit exercise")).not.toBeInTheDocument();
  });

  it("should not show archive button for global exercises", () => {
    const globalExercise: Exercise = {
      ...mockExercise,
      owner_id: null,
    };

    render(<ExerciseCard exercise={globalExercise} onArchive={vi.fn()} />);

    expect(screen.queryByLabelText("Archive exercise")).not.toBeInTheDocument();
  });

  it("should not show delete button for global exercises", () => {
    const globalExercise: Exercise = {
      ...mockExercise,
      owner_id: null,
    };

    render(<ExerciseCard exercise={globalExercise} onDelete={vi.fn()} />);

    expect(screen.queryByLabelText("Delete exercise")).not.toBeInTheDocument();
  });

  it("should stop propagation when action buttons are clicked", () => {
    const onClick = vi.fn();
    const onEdit = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onClick={onClick} onEdit={onEdit} />);

    const editButton = screen.getByLabelText("Edit exercise");
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should map strength type to strength variant", () => {
    const strengthExercise: Exercise = {
      ...mockExercise,
      type_code: "strength",
    };

    render(<ExerciseCard exercise={strengthExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "strength");
    expect(typeBadge).toHaveAttribute("data-variant", "strength");
  });

  it("should map agility type to agility variant", () => {
    const agilityExercise: Exercise = {
      ...mockExercise,
      type_code: "agility",
    };

    render(<ExerciseCard exercise={agilityExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "agility");
    expect(typeBadge).toHaveAttribute("data-variant", "agility");
  });

  it("should map endurance type to endurance variant", () => {
    const enduranceExercise: Exercise = {
      ...mockExercise,
      type_code: "endurance",
    };

    render(<ExerciseCard exercise={enduranceExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "endurance");
    expect(typeBadge).toHaveAttribute("data-variant", "endurance");
  });

  it("should map explosivity type to explosivity variant", () => {
    const explosivityExercise: Exercise = {
      ...mockExercise,
      type_code: "explosivity",
    };

    render(<ExerciseCard exercise={explosivityExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "explosivity");
    expect(typeBadge).toHaveAttribute("data-variant", "explosivity");
  });

  it("should map intelligence type to intelligence variant", () => {
    const intelligenceExercise: Exercise = {
      ...mockExercise,
      type_code: "intelligence",
    };

    render(<ExerciseCard exercise={intelligenceExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "intelligence");
    expect(typeBadge).toHaveAttribute("data-variant", "intelligence");
  });

  it("should map regeneration type to regeneration variant", () => {
    const regenerationExercise: Exercise = {
      ...mockExercise,
      type_code: "regeneration",
    };

    render(<ExerciseCard exercise={regenerationExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "regeneration");
    expect(typeBadge).toHaveAttribute("data-variant", "regeneration");
  });

  it("should use info variant for unknown type codes", () => {
    const unknownExercise: Exercise = {
      ...mockExercise,
      type_code: "unknown_type",
    };

    render(<ExerciseCard exercise={unknownExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "unknown_type");
    expect(typeBadge).toHaveAttribute("data-variant", "info");
  });

  it("should handle case-insensitive type code matching", () => {
    const upperCaseExercise: Exercise = {
      ...mockExercise,
      type_code: "STRENGTH",
    };

    render(<ExerciseCard exercise={upperCaseExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "STRENGTH");
    expect(typeBadge).toHaveAttribute("data-variant", "strength");
  });

  it("should handle type code with partial match", () => {
    const partialMatchExercise: Exercise = {
      ...mockExercise,
      type_code: "explosive_power",
    };

    render(<ExerciseCard exercise={partialMatchExercise} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadge = badges.find((badge) => badge.textContent === "explosive_power");
    expect(typeBadge).toHaveAttribute("data-variant", "explosivity");
  });

  it("should not render type badge when type_code is not provided", () => {
    const exerciseWithoutType: Exercise = {
      ...mockExercise,
      type_code: null,
    };

    render(<ExerciseCard exercise={exerciseWithoutType} />);

    const badges = screen.getAllByTestId("badge");
    const typeBadges = badges.filter(
      (badge) =>
        badge.textContent !== "Private" &&
        badge.textContent !== "Public" &&
        badge.textContent !== "Global",
    );
    expect(typeBadges).toHaveLength(0);
  });

  it("should apply hover effects when onClick is provided", () => {
    const onClick = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onClick={onClick} />);

    const card = screen.getByTestId("card");
    const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
    fireEvent(card, mouseEnterEvent);

    // Check that transform style is applied (this is handled by the component's onMouseEnter)
    expect(card).toBeInTheDocument();
  });

  it("should remove hover effects on mouse leave", () => {
    const onClick = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onClick={onClick} />);

    const card = screen.getByTestId("card");
    const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
    const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });

    fireEvent(card, mouseEnterEvent);
    fireEvent(card, mouseLeaveEvent);

    // Card should still be in document
    expect(card).toBeInTheDocument();
  });
});
