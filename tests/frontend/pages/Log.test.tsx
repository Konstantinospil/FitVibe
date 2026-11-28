import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Log from "../../src/pages/Log";
import * as api from "../../src/services/api";
import * as accountApi from "../../src/services/accountApi";
import * as sessionApi from "../../src/services/sessionApi";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && Object.keys(options).length
        ? `${key}(${Object.entries(options)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(",")})`
        : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return { ...actual, listExercises: vi.fn() };
});

vi.mock("../../src/services/accountApi", async () => {
  const actual = await vi.importActual("../../src/services/accountApi");
  return { ...actual, getUserPreferences: vi.fn() };
});

vi.mock("../../src/services/sessionApi", async () => {
  const actual = await vi.importActual("../../src/services/sessionApi");
  return { ...actual, createSession: vi.fn() };
});

const createSession = vi.mocked(sessionApi.createSession);

const exercises: api.ExercisesListResponse = {
  data: [
    {
      id: "exercise-1",
      name: "Back squat",
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
  limit: 100,
  offset: 0,
};

const PAST_DAY = "2026-11-20";

describe("Log", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "metric",
    });
    queryClient = createTestQueryClient();
    vi.mocked(api.listExercises).mockResolvedValue(exercises);
    createSession.mockResolvedValue({
      id: "logged-1",
      owner_id: "user-1",
      planned_at: "2026-11-20T09:00:00.000Z",
      planned_duration_min: 45,
      status: "completed",
      visibility: "private",
      exercises: [],
    });
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderLog = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/log"]}>
          <Routes>
            <Route path="/log" element={<Log />} />
            <Route path="/sessions/:id" element={<p>Session page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const setWhen = (day: string, time: string, minutes: string) => {
    fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.day"), {
      target: { value: day },
    });
    fireEvent.change(screen.getByLabelText("logSurface.fields.startTime"), {
      target: { value: time },
    });
    fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.duration"), {
      target: { value: minutes },
    });
  };

  const addSquat = async () => {
    await screen.findByRole("option", { name: "Back squat" });
    fireEvent.change(screen.getByRole("combobox", { name: "workoutEditor.fields.exercise" }), {
      target: { value: "exercise-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.addExercise" }));
    return screen.findByRole("heading", { level: 4, name: "Back squat" });
  };

  const setField = (setNumber: number, label: string, value: string) => {
    const set = screen.getByRole("group", { name: `sessionDetail.set(number=${setNumber})` });
    fireEvent.change(within(set).getByLabelText(label), { target: { value } });
  };

  it("logs a completed workout in one request and opens it", async () => {
    renderLog();
    fireEvent.change(screen.getByLabelText("workoutEditor.fields.name"), {
      target: { value: "Leg day" },
    });
    setWhen(PAST_DAY, "09:00", "45");
    await addSquat();
    setField(1, "workoutEditor.fields.repetitions", "5");
    setField(1, "logSurface.fields.weight", "102.5");
    setField(1, "logSurface.fields.rpe", "8");
    // A new set starts from the previous one; this one is cleared and left blank.
    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.addSet" }));
    setField(2, "workoutEditor.fields.repetitions", "");
    setField(2, "logSurface.fields.weight", "");
    setField(2, "logSurface.fields.rpe", "");

    // Intake (ADR-045) is saved with the workout, apart from its calories.
    fireEvent.change(screen.getByLabelText("workoutIntake.fields.total.water"), {
      target: { value: "750" },
    });
    // The Log's note is a post-workout note (ADR-044), not the plan's notes.
    fireEvent.change(screen.getByLabelText("workoutResult.note.label"), {
      target: { value: "  Felt strong  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession).toHaveBeenCalledWith({
      status: "completed",
      title: "Leg day",
      planned_at: new Date(2026, 10, 20, 9, 0).toISOString(),
      planned_duration_min: 45,
      result_note: "Felt strong",
      intake: [{ kind: "water", amount: 750 }],
      visibility: "private",
      exercises: [
        {
          exercise_id: "exercise-1",
          order: 1,
          sets: [
            {
              order: 1,
              status: "completed",
              reps: 5,
              weight_kg: 102.5,
              duration_sec: null,
              distance_m: null,
              rpe: 8,
              heart_rate_bpm: null,
            },
          ],
        },
      ],
    });
    expect(await screen.findByText("Session page")).toBeInTheDocument();
  });

  it("takes load in pounds for an imperial athlete and stores kilograms", async () => {
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "imperial",
    });
    renderLog();
    setWhen(PAST_DAY, "09:00", "45");
    await addSquat();
    const set = screen.getByRole("group", { name: "sessionDetail.set(number=1)" });
    const load = await within(set).findByLabelText("logSurface.fields.weightLb");
    await waitFor(() => expect(load).toBeEnabled());
    expect(within(set).queryByLabelText("logSurface.fields.weight")).not.toBeInTheDocument();
    setField(1, "workoutEditor.fields.repetitions", "5");
    setField(1, "logSurface.fields.weightLb", "225");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const [payload] = createSession.mock.calls[0];
    expect(payload.exercises?.[0].sets?.[0]).toMatchObject({ reps: 5, weight_kg: 102.06 });
  });

  it("sends an optional heart rate with a set and checks its range", async () => {
    renderLog();
    setWhen(PAST_DAY, "09:00", "45");
    await addSquat();
    setField(1, "workoutEditor.fields.repetitions", "5");
    setField(1, "logSurface.fields.heartRate", "12");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));
    expect(
      await screen.findByText(
        "logSurface.errors.invalidSet(exercise=Back squat,number=1,field=logSurface.fields.heartRate)",
      ),
    ).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();

    setField(1, "logSurface.fields.heartRate", "146");
    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession.mock.calls[0][0].exercises?.[0].sets?.[0]).toMatchObject({
      reps: 5,
      heart_rate_bpm: 146,
    });
  });

  it("holds load entry until the unit is known", async () => {
    vi.mocked(accountApi.getUserPreferences).mockReturnValue(new Promise(() => {}));
    renderLog();
    await addSquat();

    const set = screen.getByRole("group", { name: "sessionDetail.set(number=1)" });
    expect(within(set).getByLabelText("logSurface.fields.weight")).toBeDisabled();
    expect(within(set).getByLabelText("workoutEditor.fields.repetitions")).toBeEnabled();
  });

  it("adds exercises and sets without submitting the form", async () => {
    renderLog();
    await addSquat();
    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.addSet" }));

    expect(screen.getByRole("group", { name: "sessionDetail.set(number=2)" })).toBeEnabled();
    expect(screen.queryByText("logSurface.errors.noExercises")).not.toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("copies the previous set's values into a new set", async () => {
    renderLog();
    await addSquat();
    setField(1, "workoutEditor.fields.repetitions", "8");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.addSet" }));

    const second = screen.getByRole("group", { name: "sessionDetail.set(number=2)" });
    expect(within(second).getByLabelText("workoutEditor.fields.repetitions")).toHaveValue(8);
  });

  it("asks for an exercise before saving", async () => {
    renderLog();
    setWhen(PAST_DAY, "09:00", "45");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    expect(await screen.findByText("logSurface.errors.noExercises")).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a start time in the future", async () => {
    renderLog();
    await addSquat();
    setWhen("2999-01-01", "09:00", "45");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    expect(await screen.findByText("logSurface.errors.future")).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("names the set and field that is out of range", async () => {
    renderLog();
    setWhen(PAST_DAY, "09:00", "45");
    await addSquat();
    setField(1, "logSurface.fields.rpe", "11");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    expect(
      await screen.findByText(
        "logSurface.errors.invalidSet(exercise=Back squat,number=1,field=logSurface.fields.rpe)",
      ),
    ).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("explains a server refusal of a future start", async () => {
    // axios.isAxiosError only checks this flag.
    createSession.mockRejectedValue(
      Object.assign(new Error("Unprocessable"), {
        isAxiosError: true,
        response: { status: 422, data: { error: { code: "E.SESSION.LOG_IN_FUTURE" } } },
      }),
    );
    renderLog();
    setWhen(PAST_DAY, "09:00", "45");
    await addSquat();
    setField(1, "workoutEditor.fields.repetitions", "5");

    fireEvent.click(screen.getByRole("button", { name: "logSurface.actions.save" }));

    expect(await screen.findByText("logSurface.errors.future")).toBeInTheDocument();
    expect(screen.queryByText("Session page")).not.toBeInTheDocument();
  });
});
