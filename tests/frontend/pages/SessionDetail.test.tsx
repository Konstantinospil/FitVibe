import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionDetail from "../../src/pages/SessionDetail";
import * as sessionApi from "../../src/services/sessionApi";
import * as accountApi from "../../src/services/accountApi";
import type { SessionWithExercises } from "../../src/services/sessionApi";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "value" in options ? `${key}=${String(options.value)}` : key,
    i18n: { language: "en" },
  }),
}));

let currentUserId: string | null = "user-1";
vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: (
    selector: (state: { user: { id: string } | null; isAuthenticated: boolean }) => unknown,
  ) => selector({ user: currentUserId ? { id: currentUserId } : null, isAuthenticated: true }),
}));
vi.mock("../../src/services/accountApi", () => ({
  getCurrentUser: vi.fn(),
  getUserPreferences: vi.fn(),
}));

vi.mock("../../src/services/sessionApi", async () => {
  const actual = await vi.importActual("../../src/services/sessionApi");
  return {
    ...actual,
    getSession: vi.fn(),
    updateSession: vi.fn(),
    cloneSession: vi.fn(),
    getSessionVibeChanges: vi.fn(),
  };
});

const mocked = vi.mocked(sessionApi);

const baseSession = (overrides: Partial<SessionWithExercises> = {}): SessionWithExercises => ({
  id: "session-1",
  owner_id: "user-1",
  title: "Leg day",
  planned_at: "2026-12-01T17:00:00.000Z",
  planned_duration_min: 90,
  status: "planned",
  visibility: "private",
  notes: "Bring belt",
  exercises: [
    {
      id: "se-1",
      session_id: "session-1",
      exercise_id: "squat",
      exercise_name: "Back squat",
      order_index: 1,
      planned: { sets: 2, reps: 5, load: 100 },
      sets: [
        {
          id: "set-1",
          order_index: 1,
          status: "planned",
          source: "prescribed",
          planned: { reps: 5, weight_kg: 100, rest_sec: 120 },
        },
        {
          id: "set-2",
          order_index: 2,
          status: "completed",
          source: "prescribed",
          planned: { reps: 5 },
          reps: 4,
          weight_kg: 100,
          recorded_at: "2026-12-01T17:20:00Z",
        },
        {
          id: "set-3",
          order_index: 3,
          status: "skipped",
          source: "prescribed",
          planned: { reps: 3 },
        },
      ],
    },
  ],
  ...overrides,
});

describe("SessionDetail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    currentUserId = "user-1";
    queryClient = createTestQueryClient();
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "metric",
    });
    mocked.getSession.mockResolvedValue(baseSession());
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderDetail = (id = "session-1") =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/sessions/${id}`]}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/start/:id" element={<p>live workout</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("shows the schedule with its length, visibility, notes and every exercise and set", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Leg day" })).toBeInTheDocument();
    const range = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).formatRange(new Date("2026-12-01T17:00:00.000Z"), new Date("2026-12-01T18:30:00.000Z"));
    // Intl output contains narrow spaces that the default text matcher normalises away.
    expect(screen.getByText(/^sessionDetail\.plannedAt=/).textContent).toBe(
      `sessionDetail.plannedAt=${range}`,
    );
    expect(
      screen.getByText("sessionDetail.visibility=visibility.labels.private"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bring belt")).toBeInTheDocument();
    expect(screen.getByText("Back squat")).toBeInTheDocument();
    expect(
      screen.getByText("sessionDetail.sets=2 · sessionDetail.reps=5 · sessionDetail.load=100"),
    ).toBeInTheDocument();
    // Planned sets show their target, completed sets what was done next to the
    // target, skipped sets are labelled as skipped (ADR-042).
    expect(screen.getAllByText("sessionDetail.prescription")).toHaveLength(2);
    expect(screen.getByText("sessionDetail.actual")).toBeInTheDocument();
    expect(screen.getByText("sessionDetail.skipped")).toBeInTheDocument();
    expect(
      screen.getByText("sessionDetail.reps=5 · sessionDetail.load=100 · sessionDetail.rest=120"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "sessionDetail.reps=4 · sessionDetail.load=100 (sessionDetail.target=sessionDetail.reps=5)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("sessionDetail.reps=3")).toBeInTheDocument();
  });

  it("says when a completed workout was stopped early", async () => {
    mocked.getSession.mockResolvedValue(
      baseSession({
        status: "completed",
        completed_at: "2026-12-01T18:00:00.000Z",
        completion_outcome: "stopped_early",
        points: 12,
      }),
    );
    renderDetail();

    expect(await screen.findByText("sessionDetail.stoppedEarly")).toBeInTheDocument();
  });

  it("starts a planned session and opens the live workout", async () => {
    mocked.updateSession.mockResolvedValue(
      baseSession({ status: "in_progress", started_at: "2026-12-01T17:01:00.000Z" }),
    );
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "workoutEditor.actions.start" }));

    await waitFor(() =>
      expect(mocked.updateSession).toHaveBeenCalledWith("session-1", { status: "in_progress" }),
    );
    expect(await screen.findByText("live workout")).toBeInTheDocument();
  });

  it("offers to continue a workout in progress", async () => {
    mocked.getSession.mockResolvedValue(
      baseSession({ status: "in_progress", started_at: "2026-12-01T17:01:00.000Z" }),
    );
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "liveWorkout.actions.continue" }));

    expect(await screen.findByText("live workout")).toBeInTheDocument();
  });

  it("does not offer to continue someone else's workout", async () => {
    currentUserId = "user-2";
    mocked.getSession.mockResolvedValue(
      baseSession({ status: "in_progress", started_at: "2026-12-01T17:01:00.000Z" }),
    );
    renderDetail();

    expect(await screen.findByText(/^sessionDetail\.startedAt=/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "liveWorkout.actions.continue" }),
    ).not.toBeInTheDocument();
  });

  it("reports a failed start", async () => {
    mocked.updateSession.mockRejectedValue(new Error("offline"));
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "workoutEditor.actions.start" }));

    expect(await screen.findByText("sessionDetail.saveError")).toBeInTheDocument();
  });

  it("reuses the session as a private copy at the chosen time and opens the copy", async () => {
    mocked.cloneSession.mockResolvedValue(baseSession({ id: "copy-1" }));
    renderDetail();
    const reuse = await screen.findByRole("button", { name: "sessionDetail.reuse" });
    expect(reuse).toBeDisabled();

    fireEvent.change(screen.getByLabelText("sessionDetail.reuseDate"), {
      target: { value: "2026-12-08T07:30" },
    });
    fireEvent.click(reuse);

    await waitFor(() =>
      expect(mocked.cloneSession).toHaveBeenCalledWith("session-1", {
        planned_at: new Date("2026-12-08T07:30").toISOString(),
        plan_id: null,
        visibility: "private",
        recurrence_rule: null,
        include_actual: false,
      }),
    );
    // The page moves on to the copy and loads it.
    await waitFor(() => expect(mocked.getSession).toHaveBeenCalledWith("copy-1"));
  });

  it("reports a failed reuse and stays on the session", async () => {
    mocked.cloneSession.mockRejectedValue(new Error("offline"));
    renderDetail();
    fireEvent.change(await screen.findByLabelText("sessionDetail.reuseDate"), {
      target: { value: "2026-12-08T07:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "sessionDetail.reuse" }));

    expect(await screen.findByText("sessionDetail.saveError")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Leg day" })).toBeInTheDocument();
  });

  it("shows each Vibe a completed workout moved, in the usual Vibe order", async () => {
    mocked.getSession.mockResolvedValue(
      baseSession({ status: "completed", completed_at: "2026-12-01T18:20:00.000Z", points: 42 }),
    );
    mocked.getSessionVibeChanges.mockResolvedValue({
      session_id: "session-1",
      changes: [
        { domain_code: "endurance", previous_level: 980, new_level: 984, change: 4 },
        { domain_code: "strength", previous_level: 1000, new_level: 1012.5, change: 12.5 },
      ],
    });
    renderDetail();

    const panel = (await screen.findByText("vibeChanges.title")).closest<HTMLElement>(
      ".training-panel",
    )!;
    const rows = await within(panel).findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "vibes.strength.namevibeChanges.level=1,013+12.5",
      "vibes.endurance.namevibeChanges.level=984+4",
    ]);
    expect(mocked.getSessionVibeChanges).toHaveBeenCalledWith("session-1");
  });

  it("asks for Vibe changes only once points are in, and only for the owner", async () => {
    mocked.getSession.mockResolvedValue(baseSession({ status: "completed", points: null }));
    const { unmount } = renderDetail();
    expect(await screen.findByText("sessionDetail.pointsPending")).toBeInTheDocument();
    expect(screen.queryByText("vibeChanges.title")).not.toBeInTheDocument();
    unmount();

    currentUserId = "user-2";
    mocked.getSession.mockResolvedValue(baseSession({ status: "completed", points: 42 }));
    renderDetail();
    expect(await screen.findByText("homeSurface.session.points")).toBeInTheDocument();
    expect(screen.queryByText("vibeChanges.title")).not.toBeInTheDocument();
    expect(mocked.getSessionVibeChanges).not.toHaveBeenCalled();
  });

  it("says when a workout moved no Vibe, and offers a retry when the changes fail", async () => {
    mocked.getSession.mockResolvedValue(baseSession({ status: "completed", points: 0 }));
    mocked.getSessionVibeChanges.mockResolvedValueOnce({ session_id: "session-1", changes: [] });
    const { unmount } = renderDetail();
    expect(await screen.findByText("vibeChanges.none")).toBeInTheDocument();
    unmount();
    await cleanupQueryClient(queryClient);
    queryClient = createTestQueryClient();

    mocked.getSessionVibeChanges.mockRejectedValueOnce(new Error("offline"));
    mocked.getSessionVibeChanges.mockResolvedValueOnce({ session_id: "session-1", changes: [] });
    renderDetail();
    expect(await screen.findByText("vibeChanges.loadError")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "actions.retry" }));
    expect(await screen.findByText("vibeChanges.none")).toBeInTheDocument();
  });

  it("shows a set's heart rate when one was recorded", async () => {
    const session = baseSession({ status: "completed", points: 10 });
    session.exercises[0].sets[1] = { ...session.exercises[0].sets[1], heart_rate_bpm: 151 };
    mocked.getSession.mockResolvedValue(session);
    mocked.getSessionVibeChanges.mockResolvedValue({ session_id: "session-1", changes: [] });
    renderDetail();

    expect(await screen.findByText(/sessionDetail\.heartRate=151/)).toBeInTheDocument();
  });

  it("shows load in pounds for an imperial athlete", async () => {
    vi.mocked(accountApi.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "imperial",
    });
    renderDetail();

    expect(
      await screen.findByText(
        "sessionDetail.sets=2 · sessionDetail.reps=5 · sessionDetail.loadLb=220.5",
      ),
    ).toBeInTheDocument();
  });

  it("shows awarded points on a completed session, or that they are pending", async () => {
    mocked.getSession.mockResolvedValue(
      baseSession({ status: "completed", completed_at: "2026-12-01T18:20:00.000Z", points: 42 }),
    );
    const { unmount } = renderDetail();
    expect(await screen.findByText("homeSurface.session.points")).toBeInTheDocument();
    expect(screen.getByText(/^sessionDetail\.completedAt=/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workoutEditor.actions.start" }),
    ).not.toBeInTheDocument();
    unmount();
    await cleanupQueryClient(queryClient);
    queryClient = createTestQueryClient();

    mocked.getSession.mockResolvedValue(baseSession({ status: "completed", points: null }));
    renderDetail();
    expect(await screen.findByText("sessionDetail.pointsPending")).toBeInTheDocument();
  });

  it("offers no start or reuse to someone who does not own the session", async () => {
    currentUserId = "user-2";
    renderDetail();

    expect(await screen.findByText("Back squat")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workoutEditor.actions.start" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "sessionDetail.reuse" })).not.toBeInTheDocument();
  });

  it("after a reload, takes the owner from the profile and still offers the owner's actions", async () => {
    currentUserId = null;
    vi.mocked(accountApi.getCurrentUser).mockResolvedValue({
      id: "user-1",
    } as Awaited<ReturnType<typeof accountApi.getCurrentUser>>);
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "workoutEditor.actions.start" }),
    ).toBeInTheDocument();
    expect(mocked.getSession).toHaveBeenCalledWith("session-1");
    expect(accountApi.getCurrentUser).toHaveBeenCalled();
  });

  it("offers no reuse for a canceled session", async () => {
    mocked.getSession.mockResolvedValue(baseSession({ status: "canceled" }));
    renderDetail();

    expect(await screen.findByText("Back squat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "sessionDetail.reuse" })).not.toBeInTheDocument();
  });

  it("lists a session without exercises", async () => {
    mocked.getSession.mockResolvedValue(baseSession({ exercises: [] }));
    renderDetail();

    expect(await screen.findByText("sessionDetail.empty")).toBeInTheDocument();
  });

  it("offers a retry when the session cannot be loaded", async () => {
    mocked.getSession.mockRejectedValueOnce(new Error("missing"));
    renderDetail();

    expect(await screen.findByText("sessionDetail.loadError")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "actions.retry" }));
    expect(await screen.findByText("Back squat")).toBeInTheDocument();
  });
});
