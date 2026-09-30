import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseTypeManager } from "../../src/components/admin/ExerciseTypeManager";

const listExerciseTypes = vi.fn();
const createExerciseType = vi.fn();
const updateExerciseType = vi.fn();
const deleteExerciseType = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/services/api", () => ({
  listExerciseTypes: (...args: unknown[]) => listExerciseTypes(...args),
  createExerciseType: (...args: unknown[]) => createExerciseType(...args),
  updateExerciseType: (...args: unknown[]) => updateExerciseType(...args),
  deleteExerciseType: (...args: unknown[]) => deleteExerciseType(...args),
}));

describe("ExerciseTypeManager", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    listExerciseTypes.mockReset().mockResolvedValue([]);
    createExerciseType
      .mockReset()
      .mockImplementation(
        async (payload: { code: string; name: string; description?: string }) => payload,
      );
    updateExerciseType
      .mockReset()
      .mockImplementation(
        async (code: string, payload: { name?: string; description?: string }) => ({
          code,
          name: payload.name ?? "",
          description: payload.description,
        }),
      );
    deleteExerciseType.mockReset().mockResolvedValue(undefined);
  });

  it("shows an empty state after loading types", async () => {
    render(<ExerciseTypeManager />);
    expect(await screen.findByText("admin.exerciseTypes.empty")).toBeInTheDocument();
  });

  it("creates, edits, and deletes an exercise type", async () => {
    const onTypeCreated = vi.fn();
    const onTypeUpdated = vi.fn();
    const onTypeDeleted = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(
      <ExerciseTypeManager
        onTypeCreated={onTypeCreated}
        onTypeUpdated={onTypeUpdated}
        onTypeDeleted={onTypeDeleted}
      />,
    );
    expect(await screen.findByText("admin.exerciseTypes.empty")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "admin.exerciseTypes.create" })[0]);

    fireEvent.change(screen.getByLabelText(/admin.exerciseTypes.code/), {
      target: { value: "str" },
    });
    fireEvent.change(screen.getByLabelText(/admin.exerciseTypes.name/), {
      target: { value: "Strength" },
    });
    fireEvent.change(screen.getByPlaceholderText("admin.exerciseTypes.descriptionPlaceholder"), {
      target: { value: "Heavy lifts" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(createExerciseType).toHaveBeenCalledWith({
        code: "str",
        name: "Strength",
        description: "Heavy lifts",
      }),
    );
    expect(onTypeCreated).toHaveBeenCalled();
    expect(onTypeCreated.mock.calls[0][0]).toEqual(
      expect.objectContaining({ code: "str", nameEn: "Strength", descriptionEn: "Heavy lifts" }),
    );
    expect(screen.getByText("Strength (str)")).toBeInTheDocument();
    expect(screen.getByText("Heavy lifts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    fireEvent.change(screen.getByLabelText(/admin.exerciseTypes.name/), {
      target: { value: "Power" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(updateExerciseType).toHaveBeenCalledWith("str", {
        name: "Power",
        description: "Heavy lifts",
      }),
    );
    await waitFor(() =>
      expect(onTypeUpdated).toHaveBeenCalledWith(expect.objectContaining({ nameEn: "Power" })),
    );
    expect(screen.getByText("Power (str)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(deleteExerciseType).toHaveBeenCalledWith("str"));
    expect(onTypeDeleted).toHaveBeenCalled();
    expect(screen.queryByText("Power (str)")).not.toBeInTheDocument();
  });

  it("cancels create and skips delete when confirm is declined", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const onTypeCreated = vi.fn();
    const onTypeDeleted = vi.fn();

    render(<ExerciseTypeManager onTypeCreated={onTypeCreated} onTypeDeleted={onTypeDeleted} />);
    expect(await screen.findByText("admin.exerciseTypes.empty")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "admin.exerciseTypes.create" })[0]);
    fireEvent.change(screen.getByLabelText(/admin.exerciseTypes.code/), {
      target: { value: "end" },
    });
    fireEvent.change(screen.getByLabelText(/admin.exerciseTypes.name/), {
      target: { value: "Endurance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));
    await waitFor(() => expect(createExerciseType).toHaveBeenCalled());
    expect(await screen.findByText("Endurance (end)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(onTypeDeleted).not.toHaveBeenCalled();
    expect(screen.getByText("Endurance (end)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("button", { name: "common.save" })).not.toBeInTheDocument();
  });
});
