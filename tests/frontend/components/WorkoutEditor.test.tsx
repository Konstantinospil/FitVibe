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
    await screen.findByRole("option", { name: "Push up" });

    fireEvent.change(select, { target: { value: "exercise-1" } });

    const addButton = screen
      .getAllByRole("button", { name: "workoutEditor.actions.addExercise" })
      .find((button) => button.textContent === "workoutEditor.actions.addExercise");

    expect(addButton).toBeDefined();
    await waitFor(() => {
      expect(addButton).toBeEnabled();
    });

    fireEvent.click(addButton as HTMLButtonElement);

    await screen.findByLabelText("workoutEditor.fields.repetitions");
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

  it("normalizes existing exercise data and preserves planned exercise details on save", async () => {
    const existing = {
      ...savedSession,
      id: "existing-rich",
      title: null,
      notes: null,
      planned_at: "2026-03-01T10:00:00.000Z",
      started_at: "2026-03-01T10:05:00.000Z",
      exercises: [
        {
          id: "session-ex-rich",
          session_id: "existing-rich",
          exercise_id: "exercise-1",
          order_index: 0,
          planned: {
            sets: 1,
            reps: 8,
            load: 42.5,
            rpe: 7,
            extras: { rest_after_exercise_sec: 90 },
          },
          sets: [
            {
              id: "set-1",
              session_exercise_id: "session-ex-rich",
              order_index: 0,
              reps: 7,
              weight_kg: 40,
              duration_sec: 30,
              rpe: 6,
              rest_sec: 45,
            },
          ],
        },
        {
          id: "invalid-exercise",
          session_id: "existing-rich",
          exercise_id: null,
          order_index: 1,
          planned: null,
          sets: [],
        },
      ],
    } as unknown as api.SessionWithExercises;

    renderEditor(existing);

    expect(await screen.findByLabelText("workoutEditor.fields.repetitions")).toHaveValue(8);
    expect(screen.getByLabelText("workoutEditor.fields.weight")).toHaveValue(42.5);
    expect(screen.getByLabelText("workoutEditor.fields.duration")).toHaveValue(30);
    expect(screen.getByLabelText("workoutEditor.fields.exertion")).toHaveValue(7);
    expect(screen.getByLabelText("workoutEditor.fields.restSet")).toHaveValue(45);
    expect(screen.getByLabelText("workoutEditor.fields.restExercise")).toHaveValue(90);

    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.plan" }));

    await waitFor(() => {
      expect(mockedApi.updateSession).toHaveBeenCalledWith(
        "existing-rich",
        expect.objectContaining({
          title: null,
          notes: null,
          planned_at: "2026-03-01T10:00:00.000Z",
          status: "planned",
          exercises: [
            expect.objectContaining({
              planned: expect.objectContaining({
                sets: 1,
                reps: 8,
                load: 42.5,
                rpe: 7,
                extras: { rest_after_exercise_sec: 90 },
              }),
              sets: expect.arrayContaining([
                expect.objectContaining({
                  reps: 8,
                  weight_kg: 42.5,
                  duration_sec: 30,
                  rpe: 7,
                  rest_sec: 45,
                }),
              ]),
            }),
          ],
        }),
      );
    });
  });

  it("converts invalid or blank optional numeric fields to null and omits exercise rest extras", async () => {
    renderEditor();
    await addExercise();

    fireEvent.change(screen.getByLabelText("workoutEditor.fields.repetitions"), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.weight"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.duration"), {
      target: { value: "not-a-number" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.exertion"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.restSet"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.restExercise"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.plan" }));

    await waitFor(() => {
      expect(mockedApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: [
            expect.objectContaining({
              planned: expect.objectContaining({
                reps: null,
                load: null,
                rpe: null,
                extras: undefined,
              }),
              sets: [
                expect.objectContaining({
                  reps: null,
                  weight_kg: null,
                  duration_sec: null,
                  rpe: null,
                  rest_sec: null,
                }),
              ],
            }),
          ],
        }),
      );
    });
  });

  it("uses explicit plannedAt and reports the saved session through onSaved", async () => {
    const onSaved = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkoutEditor
          open
          onClose={onClose}
          plannedAt="2026-04-02T08:30:00.000Z"
          onSaved={onSaved}
        />
      </QueryClientProvider>,
    );
    await addExercise();

    fireEvent.change(screen.getByLabelText("workoutEditor.fields.name"), {
      target: { value: "  Morning session  " },
    });
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.notes"), {
      target: { value: "  Controlled tempo  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.plan" }));

    await waitFor(() => {
      expect(mockedApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Morning session",
          notes: "Controlled tempo",
          planned_at: "2026-04-02T08:30:00.000Z",
        }),
      );
      expect(onSaved).toHaveBeenCalledWith(savedSession);
    });
  });

  it("renders only the configured persistence action", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WorkoutEditor open onClose={onClose} actions={["plan"]} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "workoutEditor.actions.plan" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workoutEditor.actions.start" }),
    ).not.toBeInTheDocument();
  });

  it("does not initialize or load editor content while closed", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WorkoutEditor open={false} onClose={onClose} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText("workoutEditor.title")).not.toBeInTheDocument();
  });

});
