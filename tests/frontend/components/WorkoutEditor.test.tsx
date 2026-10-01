import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutEditor from "../../src/components/composites/WorkoutEditor";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    listExercises: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
  };
});

const { apiErrorSpy } = vi.hoisted(() => ({
  apiErrorSpy: vi.fn(),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: apiErrorSpy },
}));

const mockedApi = {
  listExercises: vi.mocked(api.listExercises),
  createSession: vi.mocked(api.createSession),
  updateSession: vi.mocked(api.updateSession),
};

const exerciseResponse: api.ExercisesListResponse = {
  data: [
    {
      id: "exercise-1",
      name: "Push up",
      type_code: "strength",
      owner_id: null,
      muscle_group: null,
      equipment: null,
      tags: [],
      is_public: true,
      description_en: null,
      description_de: null,
    },
  ],
  total: 1,
  limit: 250,
  offset: 0,
};

const savedSession: api.SessionWithExercises = {
  id: "session-created",
  owner_id: "user-1",
  title: "Upper body",
  planned_at: "2026-01-15T12:00:00.000Z",
  status: "planned",
  visibility: "private",
  exercises: [],
};

describe("WorkoutEditor", () => {
  let queryClient: QueryClient;
  const onClose = vi.fn();

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockedApi.listExercises.mockResolvedValue(exerciseResponse);
    mockedApi.createSession.mockResolvedValue(savedSession);
    mockedApi.updateSession.mockResolvedValue({
      ...savedSession,
      status: "in_progress",
    });
    onClose.mockClear();
    apiErrorSpy.mockClear();
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderEditor = (session?: api.SessionWithExercises) =>
    render(
      <QueryClientProvider client={queryClient}>
        <WorkoutEditor open onClose={onClose} session={session} />
      </QueryClientProvider>,
    );

  const addExercise = async () => {
    const select = await screen.findByLabelText("workoutEditor.fields.exercise");
    fireEvent.change(select, { target: { value: "exercise-1" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.actions.addExercise",
      }),
    );
  };

  it("creates a planned session using canonical session fields", async () => {
    renderEditor();
    await addExercise();

    fireEvent.change(screen.getByLabelText("workoutEditor.fields.name"), {
      target: { value: "Upper body" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.repetitions"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.weight"), {
      target: { value: "40" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.actions.plan",
      }),
    );

    await waitFor(() => {
      expect(mockedApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Upper body",
          visibility: "private",
          exercises: [
            expect.objectContaining({
              exercise_id: "exercise-1",
              planned: expect.objectContaining({
                sets: 1,
                reps: 12,
                load: 40,
              }),
            }),
          ],
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("starts a newly created session by transitioning the saved session", async () => {
    renderEditor();
    await addExercise();

    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.actions.start",
      }),
    );

    await waitFor(() => {
      expect(mockedApi.createSession).toHaveBeenCalled();
      expect(mockedApi.updateSession).toHaveBeenCalledWith(
        "session-created",
        expect.objectContaining({
          status: "in_progress",
          started_at: expect.any(String),
        }),
      );
    });
  });

  it("edits an existing session instead of creating a duplicate", async () => {
    const existing: api.SessionWithExercises = {
      ...savedSession,
      id: "existing",
      title: "Existing workout",
      exercises: [
        {
          id: "session-ex-1",
          session_id: "existing",
          exercise_id: "exercise-1",
          order_index: 0,
          planned: { sets: 2, reps: 8 },
          sets: [],
        },
      ],
    };
    renderEditor(existing);

    expect(await screen.findByDisplayValue("Existing workout")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.actions.plan",
      }),
    );

    await waitFor(() => {
      expect(mockedApi.updateSession).toHaveBeenCalledWith(
        "existing",
        expect.objectContaining({ status: "planned" }),
      );
    });
    expect(mockedApi.createSession).not.toHaveBeenCalled();
  });

  it("keeps derived metrics unavailable instead of reimplementing #338", async () => {
    renderEditor();

    const unavailable = await screen.findAllByText("workoutEditor.metrics.unavailable");
    expect(unavailable).toHaveLength(3);
  });

  it("retries exercise catalog loading through the active error composite", async () => {
    mockedApi.listExercises.mockRejectedValueOnce(new Error("catalog failed"));
    renderEditor();

    const retry = await screen.findByRole("button", { name: "actions.retry" });
    mockedApi.listExercises.mockResolvedValue(exerciseResponse);
    fireEvent.click(retry);

    await waitFor(() => {
      expect(mockedApi.listExercises).toHaveBeenCalledTimes(2);
    });
  });

  it("surfaces persistence errors", async () => {
    mockedApi.createSession.mockRejectedValueOnce(new Error("save failed"));
    renderEditor();
    await addExercise();

    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.actions.plan",
      }),
    );

    expect(await screen.findByText("workoutEditor.errors.save")).toBeInTheDocument();
    expect(apiErrorSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
