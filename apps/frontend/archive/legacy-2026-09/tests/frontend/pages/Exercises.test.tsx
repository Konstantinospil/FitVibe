import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Exercises from "../../src/pages/Exercises";
import type { Exercise } from "../../src/services/api";

const listExercises = vi.fn();
const createExercise = vi.fn();
const updateExercise = vi.fn();
const deleteExercise = vi.fn();
const toast = { error: vi.fn(), success: vi.fn() };
let authUser: { id: string; role: string } | null = { id: "user-1", role: "athlete" };

vi.mock("react-i18next", () => {
  const t = (key: string, fallback?: string) => (typeof fallback === "string" ? fallback : key);
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/contexts/ToastContext", () => ({
  useToast: () => toast,
}));

vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: () => ({ user: authUser }),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: vi.fn() },
}));

vi.mock("../../src/services/api", () => ({
  listExercises: (...args: unknown[]) => listExercises(...args),
  createExercise: (...args: unknown[]) => createExercise(...args),
  updateExercise: (...args: unknown[]) => updateExercise(...args),
  deleteExercise: (...args: unknown[]) => deleteExercise(...args),
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Back Squat",
    type_code: "strength",
    owner_id: "user-1",
    muscle_group: "legs",
    equipment: "barbell",
    tags: ["compound"],
    is_public: false,
    description_en: "Sit back",
    description_de: null,
    ...overrides,
  };
}

describe("Exercises page", () => {
  beforeEach(() => {
    listExercises.mockReset().mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
    createExercise.mockReset().mockResolvedValue(makeExercise());
    updateExercise.mockReset().mockResolvedValue(makeExercise());
    deleteExercise.mockReset().mockResolvedValue(undefined);
    toast.error.mockReset();
    toast.success.mockReset();
    authUser = { id: "user-1", role: "athlete" };
  });

  it("shows an empty library and toasts load errors", async () => {
    render(<Exercises />);
    expect(await screen.findByText("No exercises available")).toBeInTheDocument();

    listExercises.mockRejectedValueOnce(new Error("fail"));
    fireEvent.click(screen.getByLabelText("Show archived exercises"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load exercises"));
  });

  it("lists exercises, searches, filters, and creates one", async () => {
    listExercises.mockResolvedValue({
      data: [
        makeExercise(),
        makeExercise({
          id: "ex-2",
          name: "Run",
          type_code: "cardio",
          owner_id: null,
          is_public: true,
          muscle_group: null,
          equipment: null,
          tags: [],
          description_en: null,
        }),
        makeExercise({
          id: "ex-3",
          name: "Public Press",
          owner_id: "someone-else",
          is_public: true,
        }),
      ],
      total: 3,
      limit: 100,
      offset: 0,
    });

    render(<Exercises />);
    expect(await screen.findByText("Back Squat")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search exercises"), { target: { value: "squat" } });
    await waitFor(() =>
      expect(listExercises).toHaveBeenCalledWith(expect.objectContaining({ q: "squat" })),
    );

    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "strength" } });
    await waitFor(() =>
      expect(listExercises).toHaveBeenCalledWith(
        expect.objectContaining({ type_code: "strength" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Exercise" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(toast.error).toHaveBeenCalledWith("Name and type are required");

    const nameInput = screen.getByText("Name *").parentElement!.querySelector("input")!;
    fireEvent.change(nameInput, { target: { value: "Row" } });
    const typeSelect = screen.getByText("Type *").parentElement!.querySelector("select")!;
    fireEvent.change(typeSelect, { target: { value: "strength" } });
    fireEvent.click(screen.getByText("Make this exercise public"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createExercise).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Exercise created successfully");
  });

  it("edits and archives owned exercises", async () => {
    listExercises.mockResolvedValue({
      data: [makeExercise()],
      total: 1,
      limit: 100,
      offset: 0,
    });
    updateExercise.mockRejectedValueOnce(new Error("fail")).mockResolvedValue(makeExercise());
    deleteExercise.mockRejectedValueOnce(new Error("fail")).mockResolvedValue(undefined);

    render(<Exercises />);
    expect(await screen.findByText("Back Squat")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to update exercise"));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Exercise updated successfully"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to archive exercise"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Exercise archived successfully"),
    );
  });
});
