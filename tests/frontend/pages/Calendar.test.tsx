import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar from "../../src/pages/Calendar";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    listSessions: vi.fn(),
    listExercises: vi.fn(),
  };
});

const { apiErrorSpy } = vi.hoisted(() => ({
  apiErrorSpy: vi.fn(),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: apiErrorSpy },
}));

const mockedListSessions = vi.mocked(api.listSessions);
const mockedListExercises = vi.mocked(api.listExercises);

const response: api.SessionsListResponse = {
  data: [
    {
      id: "completed-1",
      owner_id: "user-1",
      title: "Completed Strength",
      planned_at: "2026-01-14T09:00:00.000Z",
      status: "completed",
      visibility: "private",
      completed_at: "2026-01-14T10:00:00.000Z",
      exercises: [],
    },
    {
      id: "planned-1",
      owner_id: "user-1",
      title: "Friday Plan",
      planned_at: "2026-01-16T09:00:00.000Z",
      status: "planned",
      visibility: "private",
      exercises: [],
    },
  ],
  total: 2,
  limit: 200,
  offset: 0,
};

describe("Calendar", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    queryClient = createTestQueryClient();
    mockedListSessions.mockResolvedValue(response);
    mockedListExercises.mockResolvedValue({
      data: [],
      total: 0,
      limit: 250,
      offset: 0,
    });
    apiErrorSpy.mockClear();
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderCalendar = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Calendar />
      </QueryClientProvider>,
    );

  it("renders a dynamic month with history and the remaining week", async () => {
    renderCalendar();

    expect(screen.getByText("January")).toBeInTheDocument();
    expect(screen.getByText("calendarSurface.sections.history")).toBeInTheDocument();
    expect(screen.getByText("calendarSurface.sections.weekPlan")).toBeInTheDocument();

    expect(await screen.findByText("Completed Strength")).toBeInTheDocument();
    expect(await screen.findByText("Friday Plan")).toBeInTheDocument();
  });

  it("selects a day and exposes its sessions", async () => {
    renderCalendar();
    await screen.findByText("Friday Plan");

    const dayButton = screen.getAllByRole("button").find((button) => button.textContent === "16");
    expect(dayButton).toBeDefined();

    fireEvent.click(dayButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText("Friday Plan").length).toBeGreaterThan(1);
    });
  });

  it("navigates month and year without fixed calendar data", () => {
    renderCalendar();

    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.navigation.nextMonth",
      }),
    );
    expect(screen.getByText("February")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.navigation.nextYear",
      }),
    );
    expect(screen.getByText("2027")).toBeInTheDocument();
  });

  it("opens Plan and Start as scoped transient workout workflows", async () => {
    renderCalendar();

    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.actions.plan",
      }),
    );

    expect(await screen.findByText("workoutEditor.title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workoutEditor.actions.plan" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workoutEditor.actions.start" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "workoutEditor.close",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.actions.start",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "workoutEditor.actions.start",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workoutEditor.actions.plan" }),
    ).not.toBeInTheDocument();
  });

  it("retries a failed session load from the calendar error state", async () => {
    mockedListSessions.mockRejectedValueOnce(new Error("calendar failed"));
    renderCalendar();

    const retry = await screen.findByRole("button", { name: "actions.retry" });
    mockedListSessions.mockResolvedValue(response);
    fireEvent.click(retry);

    await waitFor(() => {
      expect(mockedListSessions).toHaveBeenCalledTimes(2);
    });
  });

  it("logs and renders session loading errors", async () => {
    mockedListSessions.mockRejectedValueOnce(new Error("calendar failed"));
    renderCalendar();

    expect(await screen.findByText("calendarSurface.errors.load")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiErrorSpy).toHaveBeenCalled();
    });
  });
});
