import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseForm } from "../../src/components/exercises/ExerciseForm";

const getExercise = vi.fn();
const createExercise = vi.fn();
const updateExercise = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  getExercise: (...args: unknown[]) => getExercise(...args),
  createExercise: (...args: unknown[]) => createExercise(...args),
  updateExercise: (...args: unknown[]) => updateExercise(...args),
}));

describe("ExerciseForm", () => {
  beforeEach(() => {
    getExercise.mockReset();
    createExercise.mockReset().mockResolvedValue({ id: "ex-1", name: "Squat" });
    updateExercise.mockReset().mockResolvedValue({ id: "ex-1", name: "Front Squat" });
    showToast.mockReset();
  });

  it("creates an exercise from the card form", async () => {
    const onSave = vi.fn();
    render(<ExerciseForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/exercises.name/), { target: { value: "Squat" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "strength" } });
    fireEvent.submit(screen.getByRole("button", { name: "common.create" }).closest("form")!);

    await waitFor(() => expect(createExercise).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "exercises.created" }),
    );
  });

  it("loads and updates an existing exercise in a modal", async () => {
    getExercise.mockResolvedValue({
      name: "Squat",
      type_code: "strength",
      muscle_group: "legs",
      equipment: "barbell",
      description_en: "Low bar",
      tags: [],
    });
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<ExerciseForm exerciseId="ex-1" onCancel={onCancel} onSave={onSave} />);

    expect(await screen.findByDisplayValue("Squat")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Squat"), { target: { value: "Front Squat" } });
    fireEvent.submit(screen.getByRole("button", { name: "common.save" }).closest("form")!);

    await waitFor(() => expect(updateExercise).toHaveBeenCalledWith("ex-1", expect.any(Object)));
    expect(onSave).toHaveBeenCalled();
  });

  it("shows a create error and supports cancel", async () => {
    createExercise.mockRejectedValue(new Error("fail"));
    const onCancel = vi.fn();
    render(<ExerciseForm onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText(/exercises.name/), { target: { value: "Squat" } });
    fireEvent.submit(screen.getByRole("button", { name: "common.create" }).closest("form")!);
    expect(await screen.findByText("exercises.createError")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("returns nothing when closed", () => {
    const { container } = render(<ExerciseForm isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("loads with missing optionals, fills extra fields, and reports load/update errors", async () => {
    getExercise.mockResolvedValue({
      name: "Row",
      type_code: null,
      muscle_group: null,
      equipment: null,
      description_en: null,
      tags: null,
    });
    render(<ExerciseForm exerciseId="ex-2" />);
    expect(await screen.findByDisplayValue("Row")).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "back" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "cable" } });
    fireEvent.change(screen.getByRole("textbox", { name: /exercises.description/ }), {
      target: { value: "Pull" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "" } });

    updateExercise.mockRejectedValueOnce(new Error("fail"));
    fireEvent.submit(screen.getByRole("button", { name: "common.save" }).closest("form")!);
    expect(await screen.findByText("exercises.updateError")).toBeInTheDocument();
  });

  it("shows a load error when the exercise cannot be fetched", async () => {
    getExercise.mockRejectedValue(new Error("fail"));
    render(<ExerciseForm exerciseId="missing" onCancel={vi.fn()} />);
    expect(await screen.findByText("exercises.loadError")).toBeInTheDocument();
  });
});
