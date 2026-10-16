import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseCreator from "../../src/components/composites/ExerciseCreator";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../../src/services/api", async () => ({
  ...(await vi.importActual("../../src/services/api")),
  listExerciseTypes: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
}));
const { apiError } = vi.hoisted(() => ({ apiError: vi.fn() }));
vi.mock("../../src/utils/logger", () => ({ logger: { apiError } }));

const types = [{ code: "strength", name: "Strength" }];
const exercise = {
  id: "exercise-1",
  name: "Push-up",
  type_code: "strength",
  owner_id: "user-1",
  muscle_group: "chest",
  equipment: null,
  tags: ["upper"],
  is_public: false,
  description_en: null,
  description_de: null,
  met_value: null,
  seconds_per_rep: null,
} as api.Exercise;

describe("ExerciseCreator", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createTestQueryClient();
    vi.mocked(api.listExerciseTypes).mockResolvedValue(types);
    vi.mocked(api.createExercise).mockResolvedValue(exercise);
    vi.mocked(api.updateExercise).mockResolvedValue(exercise);
  });
  afterEach(async () => {
    await cleanupQueryClient(client);
  });

  const show = (editing?: api.Exercise) =>
    render(
      <QueryClientProvider client={client}>
        <ExerciseCreator open exercise={editing} onClose={onClose} onSaved={onSaved} />
      </QueryClientProvider>,
    );

  it("normalizes user-entered values and saves a new exercise", async () => {
    show();
    const name = await screen.findByLabelText("librarySurface.creator.fields.name");
    fireEvent.change(name, { target: { value: "  Push-up  " } });
    await screen.findByRole("option", { name: "Strength" });
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.type"), {
      target: { value: "strength" },
    });
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.tags"), {
      target: { value: " Upper, strength, upper, , CARDIO " },
    });
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.metValue"), {
      target: { value: "5.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "librarySurface.actions.save" }));

    await waitFor(() =>
      expect(api.createExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Push-up",
          type_code: "strength",
          tags: ["upper", "strength", "cardio"],
          met_value: 5.5,
          seconds_per_rep: null,
          description_en: null,
          equipment: null,
          is_public: false,
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith(exercise);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.updateExercise).not.toHaveBeenCalled();
  });

  it("edits the existing exercise instead of creating a duplicate", async () => {
    show(exercise);
    expect(await screen.findByDisplayValue("Push-up")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.name"), {
      target: { value: "Push-up variation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "librarySurface.actions.save" }));
    await waitFor(() =>
      expect(api.updateExercise).toHaveBeenCalledWith(
        "exercise-1",
        expect.objectContaining({ name: "Push-up variation", tags: ["upper"] }),
      ),
    );
    expect(api.createExercise).not.toHaveBeenCalled();
  });

  it("retains the dialog and displays an actionable error when saving fails", async () => {
    vi.mocked(api.createExercise).mockRejectedValueOnce(new Error("offline"));
    show();
    await screen.findByRole("option", { name: "Strength" });
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.name"), {
      target: { value: "Squat" },
    });
    fireEvent.change(screen.getByLabelText("librarySurface.creator.fields.type"), {
      target: { value: "strength" },
    });
    fireEvent.click(screen.getByRole("button", { name: "librarySurface.actions.save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "librarySurface.creator.errors.create",
    );
    expect(apiError).toHaveBeenCalledWith(
      "Failed to save exercise",
      expect.any(Error),
      "/api/v1/exercises",
      "POST",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not fetch exercise types when the editor is closed", () => {
    render(
      <QueryClientProvider client={client}>
        <ExerciseCreator open={false} onClose={onClose} />
      </QueryClientProvider>,
    );
    expect(api.listExerciseTypes).not.toHaveBeenCalled();
  });
});
