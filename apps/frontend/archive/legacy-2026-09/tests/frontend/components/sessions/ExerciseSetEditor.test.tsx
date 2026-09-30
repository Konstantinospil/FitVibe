import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExerciseSetEditor, type SetData } from "../../src/components/sessions/ExerciseSetEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const set = (overrides: Partial<SetData> = {}): SetData => ({
  order: 1,
  reps: 5,
  weight_kg: 80,
  rpe: 8,
  rest_sec: null,
  notes: null,
  completed: false,
  ...overrides,
});

describe("ExerciseSetEditor", () => {
  it("updates set fields, adds a set, and removes extras", () => {
    const onSetsChange = vi.fn();
    render(
      <ExerciseSetEditor
        exerciseName="Deadlift"
        sets={[set(), set({ order: 2, reps: 3, weight_kg: 90 })]}
        onSetsChange={onSetsChange}
      />,
    );

    expect(screen.getByText("Deadlift")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("logger.reps")[0], { target: { value: "6" } });
    expect(onSetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ reps: 6 })]),
    );

    fireEvent.change(screen.getAllByLabelText("logger.reps")[0], { target: { value: "" } });
    expect(onSetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ reps: null })]),
    );

    fireEvent.change(screen.getAllByLabelText("logger.load")[0], { target: { value: "82.5" } });
    expect(onSetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ weight_kg: 82.5 })]),
    );

    fireEvent.change(screen.getAllByLabelText("logger.load")[0], { target: { value: "" } });
    fireEvent.change(screen.getAllByLabelText("RPE")[0], { target: { value: "9" } });
    fireEvent.change(screen.getAllByLabelText("RPE")[0], { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    expect(onSetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ order: 3 })]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove set 2" }));
    expect(onSetsChange).toHaveBeenCalledWith([expect.objectContaining({ order: 1, reps: 5 })]);
  });

  it("toggles completed only when showCompleted is enabled", () => {
    const onSetsChange = vi.fn();
    const { rerender } = render(<ExerciseSetEditor sets={[set()]} onSetsChange={onSetsChange} />);
    expect(screen.queryByLabelText("Completed")).not.toBeInTheDocument();

    rerender(<ExerciseSetEditor sets={[set()]} onSetsChange={onSetsChange} showCompleted />);
    fireEvent.click(screen.getByLabelText("Completed"));
    expect(onSetsChange).toHaveBeenCalledWith([expect.objectContaining({ completed: true })]);
  });

  it("copies the last set values when adding the first extra set", () => {
    const onSetsChange = vi.fn();
    render(
      <ExerciseSetEditor sets={[set({ reps: 12, weight_kg: 40 })]} onSetsChange={onSetsChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    expect(onSetsChange).toHaveBeenCalledWith([
      expect.objectContaining({ order: 1 }),
      expect.objectContaining({ order: 2, reps: 12, weight_kg: 40, completed: false }),
    ]);
  });
});
