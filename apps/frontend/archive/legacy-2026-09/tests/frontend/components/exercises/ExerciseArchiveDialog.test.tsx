import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseArchiveDialog } from "../../src/components/exercises/ExerciseArchiveDialog";

const deleteExercise = vi.fn();
const showToast = vi.fn();
const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  deleteExercise: (...args: unknown[]) => deleteExercise(...args),
}));

describe("ExerciseArchiveDialog", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
    deleteExercise.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
  });

  it("does not render when closed", () => {
    render(
      <ExerciseArchiveDialog
        exerciseId="ex-1"
        exerciseName="Squat"
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("archives an exercise and closes", async () => {
    const onClose = vi.fn();
    const onArchived = vi.fn();
    render(
      <ExerciseArchiveDialog
        exerciseId="ex-1"
        exerciseName="Squat"
        isOpen
        onClose={onClose}
        onArchived={onArchived}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /exercises.archive$/ }));
    await waitFor(() => expect(deleteExercise).toHaveBeenCalledWith("ex-1"));
    expect(onArchived).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "exercises.archived",
      message: "exercises.archivedMessage",
    });
  });

  it("shows an error toast when archival fails", async () => {
    deleteExercise.mockRejectedValue(new Error("fail"));
    render(
      <ExerciseArchiveDialog exerciseId="ex-1" exerciseName="Squat" isOpen onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /exercises.archive$/ }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "exercises.archiveFailed",
        message: "exercises.archiveFailedMessage",
      }),
    );
  });

  it("uses English copy when translations are empty", async () => {
    tState.impl = () => "";
    render(
      <ExerciseArchiveDialog exerciseId="ex-1" exerciseName="Squat" isOpen onClose={vi.fn()} />,
    );

    expect(screen.getByText(/Are you sure you want to archive/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive Exercise" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Exercise Archived",
          message: "Squat has been archived",
        }),
      ),
    );
  });
});
