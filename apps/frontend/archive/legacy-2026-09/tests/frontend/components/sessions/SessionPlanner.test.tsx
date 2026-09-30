import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionPlanner, type PlannedExercise } from "../../src/components/sessions/SessionPlanner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeExercise(overrides: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    id: "ex-1",
    exercise: null,
    exerciseName: "Squat",
    order: 0,
    sets: [
      {
        order: 1,
        reps: 5,
        weight_kg: 100,
        rpe: null,
        rest_sec: null,
        notes: null,
      },
    ],
    notes: "",
    ...overrides,
  };
}

function dataTransfer() {
  return {
    effectAllowed: "none",
    dropEffect: "none",
    setData: vi.fn(),
    getData: vi.fn(),
  };
}

describe("SessionPlanner", () => {
  it("shows empty state and add action", () => {
    const onAddExercise = vi.fn();
    render(
      <SessionPlanner exercises={[]} onExercisesChange={vi.fn()} onAddExercise={onAddExercise} />,
    );
    expect(screen.getByText("planner.noExercises")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "planner.addExercise" }));
    expect(onAddExercise).toHaveBeenCalled();
  });

  it("hides add when no handler is provided", () => {
    render(<SessionPlanner exercises={[]} onExercisesChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "planner.addExercise" })).not.toBeInTheDocument();
  });

  it("reorders with buttons, keyboard, and drop, and updates notes", () => {
    const onExercisesChange = vi.fn();
    const onRemoveExercise = vi.fn();
    const exercises = [
      makeExercise({ id: "ex-1", exerciseName: "Squat", order: 0 }),
      makeExercise({ id: "ex-2", exerciseName: "Bench", order: 1, notes: "pause" }),
    ];

    render(
      <SessionPlanner
        exercises={exercises}
        onExercisesChange={onExercisesChange}
        onRemoveExercise={onRemoveExercise}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "planner.moveDown" })[0]);
    expect(onExercisesChange).toHaveBeenCalled();
    expect(onExercisesChange.mock.calls[0][0].map((ex: PlannedExercise) => ex.id)).toEqual([
      "ex-2",
      "ex-1",
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "planner.moveUp" })[1]);
    expect(onExercisesChange.mock.calls.at(-1)?.[0].map((ex: PlannedExercise) => ex.id)).toEqual([
      "ex-2",
      "ex-1",
    ]);

    const squatRow = screen.getByRole("button", { name: /Squat/ });
    fireEvent.keyDown(squatRow, { key: "ArrowDown" });
    fireEvent.keyDown(squatRow, { key: "ArrowUp" });
    fireEvent.keyDown(squatRow, { key: "Enter" });
    fireEvent.keyDown(squatRow, { key: " " });

    const dt = dataTransfer();
    fireEvent.dragStart(squatRow, { dataTransfer: dt });
    const benchRow = screen.getByRole("button", { name: /Bench/ });
    fireEvent.dragOver(benchRow, { dataTransfer: dt });
    fireEvent.drop(benchRow, { dataTransfer: dt });
    fireEvent.dragLeave(benchRow);
    fireEvent.dragEnd(squatRow, { dataTransfer: dt });
    expect(onExercisesChange).toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue("pause"), { target: { value: "slow" } });
    expect(onExercisesChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "ex-2", notes: "slow" })]),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "planner.removeExercise" })[0]);
    expect(onRemoveExercise).toHaveBeenCalledWith("ex-1");
  });

  it("ignores dropping an exercise onto itself", () => {
    const onExercisesChange = vi.fn();
    const exercise = makeExercise();
    render(<SessionPlanner exercises={[exercise]} onExercisesChange={onExercisesChange} />);

    const row = screen.getByRole("button", { name: /Squat/ });
    const dt = dataTransfer();
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.drop(row, { dataTransfer: dt });
    expect(onExercisesChange).not.toHaveBeenCalled();
  });
});
