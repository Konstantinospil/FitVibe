import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar from "../../src/pages/Calendar";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      key === "calendarSurface.dayLabel" && options?.date
        ? `${key}:${options.date}`
        : key,
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

const atLocalHour = (base: Date, hour: number) => {
  const value = new Date(base);
  value.setHours(hour, 0, 0, 0);
  return value;
};

const addDays = (base: Date, days: number) => {
  const value = new Date(base);
  value.setDate(value.getDate() + days);
  return value;
};

describe("Calendar", () => {
  let queryClient: QueryClient;
  let today: Date;
  let tomorrow: Date;
  let response: api.SessionsListResponse;

  beforeEach(() => {
    today = new Date();
    today.setHours(12, 0, 0, 0);
    tomorrow = addDays(today, 1);

    response = {
      data: [
        {
          id: "completed-1",
          owner_id: "user-1",
          title: "Completed Strength",
          planned_at: atLocalHour(addDays(today, -1), 9).toISOString(),
          status: "completed",
          visibility: "private",
          completed_at: atLocalHour(addDays(today, -1), 10).toISOString(),
          exercises: [],
        },
        {
          id: "planned-today",
          owner_id: "user-1",
          title: "Today Plan",
          planned_at: atLocalHour(today, 18).toISOString(),
          status: "planned",
          visibility: "private",
          exercises: [],
        },
        {
          id: "planned-tomorrow",
          owner_id: "user-1",
          title: "Tomorrow Plan",
          planned_at: atLocalHour(tomorrow, 9).toISOString(),
          status: "planned",
          visibility: "private",
          exercises: [],
        },
      ],
      total: 3,
      limit: 200,
      offset: 0,
    };

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

    const month = new Intl.DateTimeFormat("en", { month: "long" }).format(today);
    expect(screen.getByText(month)).toBeInTheDocument();
    expect(screen.getByText("calendarSurface.sections.history")).toBeInTheDocument();
    expect(screen.getByText("calendarSurface.sections.weekPlan")).toBeInTheDocument();

    expect(await screen.findByText("Completed Strength")).toBeInTheDocument();
    expect(await screen.findAllByText("Today Plan")).not.toHaveLength(0);
  });

  it("selects a day and exposes its sessions", async () => {
    renderCalendar();
    expect(await screen.findAllByText("Today Plan")).not.toHaveLength(0);

    const fullDate = new Intl.DateTimeFormat("en", {
      dateStyle: "full",
    }).format(tomorrow);
    const dayButton = screen.getByRole("button", {
      name: `calendarSurface.dayLabel:${fullDate}`,
    });

    fireEvent.click(dayButton);

    await waitFor(() => {
      expect(screen.getAllByText("Tomorrow Plan").length).toBeGreaterThan(0);
    });
  });

  it("navigates month and year without fixed calendar data", () => {
    renderCalendar();

    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.navigation.nextMonth",
      }),
    );
    expect(
      screen.getByText(new Intl.DateTimeFormat("en", { month: "long" }).format(nextMonth)),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "calendarSurface.navigation.nextYear",
      }),
    );
    expect(screen.getByText(String(nextMonth.getFullYear() + 1))).toBeInTheDocument();
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

export {};
