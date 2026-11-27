import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveWorkout from "../../src/pages/LiveWorkout";
import * as api from "../../src/services/api";
import * as accountApi from "../../src/services/accountApi";
import * as sessionApi from "../../src/services/sessionApi";
import type { SessionWithExercises } from "../../src/services/sessionApi";
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
  return {
    ...actual,
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    recordSet: vi.fn(),
    addSessionSet: vi.fn(),
    addSessionExercise: vi.fn(),
    skipSessionExercise: vi.fn(),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
  };
});

const mocked = vi.mocked(sessionApi);

const START = "2026-12-01T17:00:00.000Z";
const iso = (seconds: number) => new Date(new Date(START).getTime() + seconds * 1000).toISOString();

const liveSession = (overrides: Partial<SessionWithExercises> = {}): SessionWithExercises => ({
  id: "session-1",
  owner_id: "user-1",
  title: "Leg day",
  planned_at: START,
  planned_duration_min: 60,
  status: "in_progress",
  visibility: "private",
  started_at: START,
  paused_at: null,
  paused_seconds: 120,
  exercises: [
    {
      id: "se-1",
      session_id: "session-1",
      exercise_id: "squat",
      exercise_name: "Back squat",
      order_index: 1,
      status: "planned",
      source: "prescribed",
      sets: [
        {
          id: "set-1",
          order_index: 1,
          status: "completed",
          source: "prescribed",
          planned: { reps: 5, weight_kg: 100, rest_sec: 90 },
          reps: 5,
          weight_kg: 100,
          recorded_at: iso(600),
        },
        {
          id: "set-2",
          order_index: 2,
          status: "planned",
          source: "prescribed",
          planned: { reps: 5, weight_kg: 100, rest_sec: 90 },
        },
      ],
    },
    {
      id: "se-2",
      session_id: "session-1",
      exercise_id: "plank",
      exercise_name: "Plank",
      order_index: 2,
      status: "planned",
      source: "prescribed",
      sets: [
        {
          id: "set-3",
          order_index: 1,
          status: "planned",
          source: "prescribed",
          planned: { duration_sec: 60 },
        },
      ],
    },
  ],
  ...overrides,
});

/** The same workout after set-2 was recorded. */
const afterSecondSet = () => {
  const value = liveSession();
  value.exercises[0].sets[1] = {
    ...value.exercises[0].sets[1],
    status: "completed",
    reps: 6,
    weight_kg: 100,
    recorded_at: iso(630),
  };
  return value;
};

const exercises: api.ExercisesListResponse = {
  data: [
    {
      id: "lunge",
      name: "Walking lunge",
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

// axios.isAxiosError only checks this flag.
const conflict = () =>
  Object.assign(new Error("conflict"), {
    isAxiosError: true,
    response: { status: 409, data: { error: { code: "E.SESSION.NOT_ACTIVE" } } },
  });

describe("LiveWorkout", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "metric",
    });
    // Only the clock is fixed; timers and promises run normally.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso(630)));
    queryClient = createTestQueryClient();
    vi.mocked(api.listExercises).mockResolvedValue(exercises);
    mocked.getSession.mockResolvedValue(liveSession());
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderLive = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/start/session-1"]}>
          <Routes>
            <Route path="/start/:id" element={<LiveWorkout />} />
            <Route path="/sessions/:id" element={<p>Session page</p>} />
            <Route path="/" element={<p>Home page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const currentSet = async () =>
    (await screen.findByRole("heading", { level: 2, name: "Back squat" })).closest("form")!;

  it("shows training time without pauses, the rest left, and the set to do with its target", async () => {
    renderLive();

    const form = await currentSet();
    const [active, elapsed] = screen.getAllByRole("timer");
    // 630 s since the start, 120 s of it paused.
    expect(active).toHaveTextContent("8:30");
    expect(elapsed).toHaveTextContent("10:30");
    // 90 s rest after the set recorded at 600 s.
    expect(screen.getByText("liveWorkout.rest").nextSibling).toHaveTextContent("1:00");

    expect(
      within(form).getByText("liveWorkout.current.setOf(number=2,count=2)"),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText("workoutEditor.fields.repetitions")).toHaveValue(5);
    expect(within(form).getByLabelText("logSurface.fields.weight")).toHaveValue(100);
    expect(within(form).queryByLabelText("logSurface.fields.rpe")).not.toBeInTheDocument();
    expect(screen.getByText("liveWorkout.current.next(name=Plank,number=1)")).toBeInTheDocument();
  });

  it("records what was done and moves on to the next set", async () => {
    mocked.recordSet.mockResolvedValue(afterSecondSet());
    renderLive();

    const form = await currentSet();
    fireEvent.change(within(form).getByLabelText("workoutEditor.fields.repetitions"), {
      target: { value: "6" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.completeSet" }));

    await waitFor(() =>
      expect(mocked.recordSet).toHaveBeenCalledWith("session-1", "set-2", {
        status: "completed",
        reps: 6,
        weight_kg: 100,
        duration_sec: null,
        distance_m: null,
        rpe: null,
        heart_rate_bpm: null,
      }),
    );
    expect(await screen.findByRole("heading", { level: 2, name: "Plank" })).toBeInTheDocument();
    expect(screen.getByLabelText("workoutEditor.fields.duration")).toHaveValue(60);
  });

  it("shows the target and takes load in pounds for an imperial athlete", async () => {
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "imperial",
    });
    mocked.recordSet.mockResolvedValue(afterSecondSet());
    renderLive();

    const form = await currentSet();
    // The 100 kg target, in pounds.
    const load = await within(form).findByLabelText("logSurface.fields.weightLb");
    expect(load).toHaveValue(220.5);
    expect(
      within(form).getByText(
        "liveWorkout.current.target(value=sessionDetail.reps(value=5) · sessionDetail.loadLb(value=220.5) · sessionDetail.rest(value=90))",
      ),
    ).toBeInTheDocument();
    fireEvent.change(load, { target: { value: "225" } });
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.completeSet" }));

    await waitFor(() =>
      expect(mocked.recordSet).toHaveBeenCalledWith("session-1", "set-2", {
        status: "completed",
        reps: 5,
        weight_kg: 102.06,
        duration_sec: null,
        distance_m: null,
        rpe: null,
        heart_rate_bpm: null,
      }),
    );
  });

  it("offers an optional heart rate on every set, never prefilled", async () => {
    mocked.recordSet.mockResolvedValue(afterSecondSet());
    renderLive();

    const form = await currentSet();
    const heartRate = within(form).getByLabelText("logSurface.fields.heartRate");
    expect(heartRate).toHaveValue(null);
    fireEvent.change(heartRate, { target: { value: "158" } });
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.completeSet" }));

    await waitFor(() =>
      expect(mocked.recordSet).toHaveBeenCalledWith(
        "session-1",
        "set-2",
        expect.objectContaining({ status: "completed", reps: 5, heart_rate_bpm: 158 }),
      ),
    );
  });

  it("skips a set without sending values", async () => {
    mocked.recordSet.mockResolvedValue(afterSecondSet());
    renderLive();

    const form = await currentSet();
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.skipSet" }));

    await waitFor(() =>
      expect(mocked.recordSet).toHaveBeenCalledWith("session-1", "set-2", { status: "skipped" }),
    );
  });

  it("holds an invalid value back and names the field", async () => {
    renderLive();

    const form = await currentSet();
    fireEvent.change(within(form).getByLabelText("workoutEditor.fields.repetitions"), {
      target: { value: "5.5" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.completeSet" }));

    expect(
      await screen.findByText(
        "liveWorkout.errors.invalidSet(field=workoutEditor.fields.repetitions)",
      ),
    ).toBeInTheDocument();
    expect(mocked.recordSet).not.toHaveBeenCalled();
  });

  it("pauses: the training clock stops and sets wait for Resume", async () => {
    mocked.pauseSession.mockResolvedValue(liveSession({ paused_at: iso(630) }));
    renderLive();

    await currentSet();
    fireEvent.click(screen.getByRole("button", { name: "liveWorkout.actions.pause" }));

    expect(await screen.findByText("liveWorkout.pausedNotice")).toBeInTheDocument();
    expect(mocked.pauseSession).toHaveBeenCalledWith("session-1");
    expect(screen.getByText("liveWorkout.clock.paused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "liveWorkout.actions.completeSet" })).toBeDisabled();
    expect(screen.queryByText("liveWorkout.rest")).not.toBeInTheDocument();

    mocked.resumeSession.mockResolvedValue(liveSession());
    fireEvent.click(screen.getByRole("button", { name: "liveWorkout.actions.resume" }));
    await waitFor(() => expect(mocked.resumeSession).toHaveBeenCalledWith("session-1"));
    expect(
      await screen.findByRole("button", { name: "liveWorkout.actions.completeSet" }),
    ).toBeEnabled();
  });

  it("adds a set from the last one's target with a fresh idempotency key", async () => {
    mocked.addSessionSet.mockResolvedValue(liveSession());
    renderLive();

    await currentSet();
    fireEvent.click(
      screen.getByRole("button", { name: "liveWorkout.actions.addSetTo(name=Back squat)" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "liveWorkout.actions.addSetTo(name=Back squat)",
      }),
    );

    await waitFor(() => expect(mocked.addSessionSet).toHaveBeenCalledTimes(2));
    const [first, second] = mocked.addSessionSet.mock.calls;
    expect(first.slice(0, 3)).toEqual([
      "session-1",
      "se-1",
      { reps: 5, weight_kg: 100, rest_sec: 90 },
    ]);
    expect(typeof first[3]).toBe("string");
    expect(second[3]).not.toBe(first[3]);
  });

  it("skips an exercise and adds one from the catalogue", async () => {
    mocked.skipSessionExercise.mockResolvedValue(liveSession());
    mocked.addSessionExercise.mockResolvedValue(liveSession());
    renderLive();

    await currentSet();
    fireEvent.click(
      screen.getByRole("button", { name: "liveWorkout.actions.skipExercise(name=Plank)" }),
    );
    await waitFor(() =>
      expect(mocked.skipSessionExercise).toHaveBeenCalledWith("session-1", "se-2"),
    );

    const select = await screen.findByRole("combobox", { name: "workoutEditor.fields.exercise" });
    await within(select).findByRole("option", { name: "Walking lunge" });
    fireEvent.change(select, { target: { value: "lunge" } });
    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.addExercise" }));

    await waitFor(() =>
      expect(mocked.addSessionExercise).toHaveBeenCalledWith(
        "session-1",
        "lunge",
        expect.any(String),
      ),
    );
    expect(select).toHaveValue("");
  });

  it("finishes as stopped early and opens the session page", async () => {
    mocked.updateSession.mockResolvedValue(
      liveSession({ status: "completed", completion_outcome: "stopped_early" }),
    );
    renderLive();

    await currentSet();
    fireEvent.click(screen.getByRole("button", { name: "liveWorkout.actions.finish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("liveWorkout.finish.done").nextSibling).toHaveTextContent("1");
    expect(within(dialog).getByText("liveWorkout.finish.remaining").nextSibling).toHaveTextContent(
      "2",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "liveWorkout.actions.saveStoppedEarly" }),
    );

    await waitFor(() =>
      expect(mocked.updateSession).toHaveBeenCalledWith("session-1", {
        status: "completed",
        completion_outcome: "stopped_early",
      }),
    );
    expect(await screen.findByText("Session page")).toBeInTheDocument();
  });

  it("discards only after a second confirmation", async () => {
    mocked.deleteSession.mockResolvedValue(undefined);
    renderLive();

    await currentSet();
    fireEvent.click(screen.getByRole("button", { name: "liveWorkout.actions.finish" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "liveWorkout.actions.discard" }));
    expect(mocked.deleteSession).not.toHaveBeenCalled();
    expect(
      await within(dialog).findByText("liveWorkout.finish.discardWarning"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "liveWorkout.actions.confirmDiscard" }),
    );

    await waitFor(() => expect(mocked.deleteSession).toHaveBeenCalledWith("session-1"));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("explains when the workout has ended elsewhere", async () => {
    mocked.recordSet.mockRejectedValue(conflict());
    renderLive();

    const form = await currentSet();
    fireEvent.click(within(form).getByRole("button", { name: "liveWorkout.actions.skipSet" }));

    expect(await screen.findByText("liveWorkout.errors.notActive")).toBeInTheDocument();
  });

  it("opens the session page for a finished workout", async () => {
    mocked.getSession.mockResolvedValue(liveSession({ status: "completed" }));
    renderLive();

    expect(await screen.findByText("Session page")).toBeInTheDocument();
  });

  it("starts a planned workout from here", async () => {
    mocked.getSession.mockResolvedValue(liveSession({ status: "planned", started_at: null }));
    mocked.updateSession.mockResolvedValue(liveSession());
    renderLive();

    expect(await screen.findByText("liveWorkout.notStarted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "workoutEditor.actions.start" }));

    await waitFor(() =>
      expect(mocked.updateSession).toHaveBeenCalledWith("session-1", { status: "in_progress" }),
    );
    expect(await currentSet()).toBeInTheDocument();
  });
});
