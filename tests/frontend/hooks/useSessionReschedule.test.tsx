import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useQuery, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionReschedule } from "../../src/hooks/useSessionReschedule";
import { CALENDAR_QUERY_KEY } from "../../src/lib/scheduling/calendarQuery";
import * as sessionApi from "../../src/services/sessionApi";
import type { SessionListItem, SessionsListResponse } from "../../src/services/sessionApi";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

vi.mock("../../src/services/sessionApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/sessionApi")>(
    "../../src/services/sessionApi",
  );
  return { ...actual, updateSession: vi.fn() };
});

const { apiErrorSpy } = vi.hoisted(() => ({ apiErrorSpy: vi.fn() }));
vi.mock("../../src/utils/logger", () => ({ logger: { apiError: apiErrorSpy } }));

const mockedUpdateSession = vi.mocked(sessionApi.updateSession);

const MOVING_FROM = "2026-11-02T08:00:00.000Z";
const FREE_SLOT = "2026-11-03T08:00:00.000Z";
const TAKEN_SLOT = "2026-11-04T08:00:00.000Z";
const WINDOW_KEY = [...CALENDAR_QUERY_KEY, "2026-10-26", "2026-12-06"];

const item = (id: string, planned_at: string, planned_duration_min = 60): SessionListItem => ({
  id,
  owner_id: "user-1",
  planned_at,
  planned_duration_min,
  status: "planned",
  visibility: "private",
  exercise_count: 0,
});

const moving = item("moving", MOVING_FROM);
const occupant = item("occupant", TAKEN_SLOT);
const move = (plannedAt: string, durationMin = 60) => ({ plannedAt, durationMin });

const conflictError = () => ({
  isAxiosError: true,
  response: {
    status: 422,
    data: {
      error: {
        code: "E.SESSION.SCHEDULE_CONFLICT",
        details: { conflictingSessionIds: ["outside-window"] },
      },
    },
  },
});

describe("useSessionReschedule", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    const cached: SessionsListResponse = {
      data: [moving, occupant],
      total: 2,
      limit: 200,
      offset: 0,
    };
    queryClient.setQueryData(WINDOW_KEY, cached);
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  // The calendar page observes its window query; a disabled observer mirrors that
  // without fetching, so the test client's gcTime: 0 does not evict the cache.
  const renderReschedule = () =>
    renderHook(
      () => {
        useQuery({ queryKey: WINDOW_KEY, queryFn: () => Promise.reject(), enabled: false });
        return useSessionReschedule([moving, occupant]);
      },
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

  const cached = (id: string) =>
    queryClient
      .getQueryData<SessionsListResponse>(WINDOW_KEY)
      ?.data.find((session) => session.id === id);
  const cachedPlannedAt = (id: string) => cached(id)?.planned_at;

  it("refuses a move that overlaps a loaded session without calling the API", async () => {
    const { result } = renderReschedule();

    let outcome: Awaited<ReturnType<typeof result.current.reschedule>> | undefined;
    // 07:30–08:30 runs into the occupant's 08:00–09:00.
    await act(async () => {
      outcome = await result.current.reschedule(moving, move("2026-11-04T07:30:00.000Z"));
    });

    expect(outcome).toEqual({
      status: "conflict",
      conflictingIds: ["occupant"],
      plannedAt: "2026-11-04T07:30:00.000Z",
      durationMin: 60,
    });
    expect(mockedUpdateSession).not.toHaveBeenCalled();
    expect(cachedPlannedAt("moving")).toBe(MOVING_FROM);
  });

  it("saves a free move and updates the cached calendar before the request settles", async () => {
    let resolveRequest: (value: sessionApi.SessionWithExercises) => void = () => undefined;
    mockedUpdateSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result } = renderReschedule();

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.reschedule(moving, move(FREE_SLOT));
    });

    await waitFor(() => {
      expect(mockedUpdateSession).toHaveBeenCalledWith("moving", { planned_at: FREE_SLOT });
    });
    expect(cachedPlannedAt("moving")).toBe(FREE_SLOT);

    await act(async () => {
      resolveRequest({ ...moving, planned_at: FREE_SLOT, exercises: [] });
      await expect(pending).resolves.toEqual({
        status: "saved",
        plannedAt: FREE_SLOT,
        durationMin: 60,
      });
    });
  });

  it("sends only the length for a resize and updates it in the cache", async () => {
    mockedUpdateSession.mockResolvedValue({ ...moving, planned_duration_min: 90, exercises: [] });
    const { result } = renderReschedule();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.reschedule(moving, move(MOVING_FROM, 90));
    });

    expect(mockedUpdateSession).toHaveBeenCalledWith("moving", { planned_duration_min: 90 });
    expect(outcome).toEqual({ status: "saved", plannedAt: MOVING_FROM, durationMin: 90 });
  });

  it("refuses a resize that runs into the next session", async () => {
    const { result } = renderReschedule();
    const early = item("early", "2026-11-04T06:00:00.000Z", 60);

    let outcome: unknown;
    await act(async () => {
      // 06:00 + 121 minutes reaches past the occupant's 08:00 start.
      outcome = await result.current.reschedule(early, move(early.planned_at, 121));
    });

    expect(outcome).toMatchObject({ status: "conflict", conflictingIds: ["occupant"] });
    expect(mockedUpdateSession).not.toHaveBeenCalled();
  });

  it("restores the calendar and reports the server's conflicting IDs on a 422", async () => {
    mockedUpdateSession.mockRejectedValue(conflictError());
    const { result } = renderReschedule();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.reschedule(moving, move(FREE_SLOT, 45));
    });

    expect(outcome).toEqual({
      status: "conflict",
      conflictingIds: ["outside-window"],
      plannedAt: FREE_SLOT,
      durationMin: 45,
    });
    expect(cached("moving")?.planned_duration_min).toBe(60);
    expect(cachedPlannedAt("moving")).toBe(MOVING_FROM);
    expect(apiErrorSpy).not.toHaveBeenCalled();
  });

  it("restores the calendar and logs any other failure", async () => {
    mockedUpdateSession.mockRejectedValue(new Error("offline"));
    const { result } = renderReschedule();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.reschedule(moving, move(FREE_SLOT));
    });

    expect(outcome).toEqual({ status: "failed" });
    expect(cachedPlannedAt("moving")).toBe(MOVING_FROM);
    expect(apiErrorSpy).toHaveBeenCalledWith(
      "Failed to reschedule session",
      expect.any(Error),
      "/api/v1/sessions/moving",
      "PATCH",
    );
  });
});
