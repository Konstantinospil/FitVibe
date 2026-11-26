import { MemoryRouter } from "react-router-dom";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar from "../../src/pages/Calendar";
import * as api from "../../src/services/api";
import * as sessionApi from "../../src/services/sessionApi";
import { localDateKey } from "../../src/lib/scheduling/sessionSchedule";
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

vi.mock("../../src/services/sessionApi", async () => {
  const actual = await vi.importActual("../../src/services/sessionApi");
  return {
    ...actual,
    updateSession: vi.fn(),
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
const mockedUpdateSession = vi.mocked(sessionApi.updateSession);

const atLocalHour = (base: Date, hour: number, minutes = 0) => {
  const value = new Date(base);
  value.setHours(hour, minutes, 0, 0);
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
          exercise_count: 0,
        },
        {
          id: "planned-today",
          owner_id: "user-1",
          title: "Today Plan",
          planned_at: atLocalHour(today, 18).toISOString(),
          status: "planned",
          visibility: "private",
          exercise_count: 0,
        },
        {
          id: "planned-tomorrow",
          owner_id: "user-1",
          title: "Tomorrow Plan",
          planned_at: atLocalHour(tomorrow, 9).toISOString(),
          status: "planned",
          visibility: "private",
          exercise_count: 0,
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
        <MemoryRouter><Calendar /></MemoryRouter>
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

  it("loads a full 200-session calendar with backend-safe pages", async () => {
    const previousDays = Array.from({ length: 100 }, (_, i) => ({
      id: `completed-${i}`,
      owner_id: "user-1",
      title: `Previous workout ${i}`,
      planned_at: atLocalHour(addDays(today, -3), 12).toISOString(),
      status: "completed" as const,
      visibility: "private" as const,
      exercise_count: 0,
    }));
    mockedListSessions.mockReset();
    mockedListSessions
      .mockResolvedValueOnce({ data: previousDays, total: 101, limit: 100, offset: 0 })
      .mockResolvedValueOnce({
        data: [{
          id: "more-session",
          owner_id: "user-1",
          title: "Second page workout",
          planned_at: atLocalHour(today, 18).toISOString(),
          status: "planned",
          visibility: "private",
          exercise_count: 0,
        }],
        total: 101,
        limit: 100,
        offset: 100,
      });
    renderCalendar();
    expect(await screen.findAllByText("Second page workout")).not.toHaveLength(0);
    expect(mockedListSessions).toHaveBeenCalledTimes(2);
    expect(mockedListSessions.mock.calls[0][0]).toMatchObject({ limit: 100, offset: 0 });
    expect(mockedListSessions.mock.calls[1][0]).toMatchObject({ limit: 100, offset: 100 });
  });

  it("selects a day and exposes its sessions", async () => {
    renderCalendar();
    expect(await screen.findAllByText("Today Plan")).not.toHaveLength(0);

    const fullDate = new Intl.DateTimeFormat("en", {
      dateStyle: "full",
    }).format(tomorrow);
    const dayButton = screen.getByRole("button", {
      name: `${String(tomorrow.getDate()).padStart(2, "0")} — calendarSurface.dayLabel:${fullDate}`,
    });

    expect(dayButton).toHaveAccessibleName(`${String(tomorrow.getDate()).padStart(2, "0")} — calendarSurface.dayLabel:${fullDate}`);
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

  describe("rescheduling planned sessions (US-4.3 / US-4.4 / US-13.3)", () => {
    const MOVE = "calendarSurface.schedule.moveLabel";
    const originalElementFromPoint = document.elementFromPoint;
    let pointerTarget: Element | null;

    beforeEach(() => {
      pointerTarget = null;
      document.elementFromPoint = vi.fn(() => pointerTarget);
      mockedUpdateSession.mockImplementation(
        async (id, payload) =>
          ({
            ...response.data.find((session) => session.id === id)!,
            ...payload,
            exercises: [],
          }) as sessionApi.SessionWithExercises,
      );
    });

    afterEach(() => {
      document.elementFromPoint = originalElementFromPoint;
    });

    const dayCell = (date: Date) => {
      const cell = document.querySelector(`[data-schedule-day="${localDateKey(date)}"]`);
      if (!cell) {
        throw new Error(`No calendar cell for ${localDateKey(date)}`);
      }
      return cell;
    };

    const status = () =>
      screen.getAllByRole("status").find((node) => node.getAttribute("aria-live") === "polite");

    const dragHandleTo = (handle: HTMLElement, target: Element) => {
      fireEvent.pointerDown(handle, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 5,
        clientY: 5,
      });
      pointerTarget = target;
      fireEvent.pointerMove(handle, { pointerId: 1, isPrimary: true, clientX: 120, clientY: 80 });
    };

    const release = (handle: HTMLElement) =>
      fireEvent.pointerUp(handle, { pointerId: 1, isPrimary: true, clientX: 120, clientY: 80 });

    it("offers the move handle only on planned sessions", async () => {
      // Select yesterday: it holds a completed session only.
      renderCalendar();
      const yesterday = addDays(today, -1);
      const fullDate = new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(yesterday);
      fireEvent.click(
        await screen.findByRole("button", {
          name: `${String(yesterday.getDate()).padStart(2, "0")} — calendarSurface.dayLabel:${fullDate}`,
        }),
      );

      const selectedDay = document.querySelector(".calendar-surface__selected-day") as HTMLElement;
      expect(await within(selectedDay).findByText("Completed Strength")).toBeInTheDocument();
      expect(within(selectedDay).queryByRole("button", { name: MOVE })).not.toBeInTheDocument();
    });

    it("moves a session to a new day and time with the keyboard dialog", async () => {
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      fireEvent.click(handle);
      expect(await screen.findByText("calendarSurface.schedule.dialog.title")).toBeInTheDocument();
      const target = addDays(today, 3);
      fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.day"), {
        target: { value: localDateKey(target) },
      });
      fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.time"), {
        target: { value: "07:30" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "calendarSurface.schedule.actions.save" }),
      );

      const expected = new Date(target);
      expected.setHours(7, 30, 0, 0);
      await waitFor(() => {
        expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
          planned_at: expected.toISOString(),
        });
      });
      await waitFor(() => {
        expect(screen.queryByText("calendarSurface.schedule.dialog.title")).not.toBeInTheDocument();
      });
      expect(status()).toHaveTextContent("calendarSurface.schedule.status.rescheduled");
    });

    it("changes the length in the dialog and validates it", async () => {
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      fireEvent.click(handle);
      const length = await screen.findByLabelText("calendarSurface.schedule.fields.duration");
      expect(length).toHaveValue(60);
      // The field's own limits stop the form before anything is sent.
      fireEvent.change(length, { target: { value: "3" } });
      expect(length).toBeInvalid();
      fireEvent.submit(length.closest("form")!);
      expect(
        await screen.findByText("calendarSurface.schedule.errors.invalidDuration"),
      ).toBeInTheDocument();
      expect(mockedUpdateSession).not.toHaveBeenCalled();

      fireEvent.change(length, { target: { value: "45" } });
      fireEvent.click(
        screen.getByRole("button", { name: "calendarSurface.schedule.actions.save" }),
      );
      await waitFor(() => {
        expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
          planned_duration_min: 45,
        });
      });
    });

    it("refuses a dialog move onto another workout's time before saving", async () => {
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      fireEvent.click(handle);
      fireEvent.change(await screen.findByLabelText("calendarSurface.schedule.fields.day"), {
        target: { value: localDateKey(tomorrow) },
      });
      fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.time"), {
        target: { value: "09:00" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "calendarSurface.schedule.actions.save" }),
      );

      expect(
        await screen.findByText("calendarSurface.schedule.errors.conflict"),
      ).toBeInTheDocument();
      expect(mockedUpdateSession).not.toHaveBeenCalled();
      expect(screen.getByText("calendarSurface.schedule.dialog.title")).toBeInTheDocument();
    });

    it("drags a session onto another day, keeping its time, without reloading the page", async () => {
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });
      const target = addDays(today, 3);

      dragHandleTo(handle, dayCell(target));
      expect(dayCell(target)).toHaveClass("calendar-month__cell--drop-target");
      release(handle);

      const expected = atLocalHour(target, 18);
      await waitFor(() => {
        expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
          planned_at: expected.toISOString(),
        });
      });
      expect(mockedListSessions).toHaveBeenCalled();
      expect(
        await screen.findByText("calendarSurface.schedule.status.rescheduled"),
      ).toBeInTheDocument();
    });

    it("highlights a conflict while hovering and refuses the drop before saving", async () => {
      const evening = addDays(today, 2);
      response.data.push({
        id: "planned-evening",
        owner_id: "user-1",
        title: "Evening Plan",
        planned_at: atLocalHour(evening, 18).toISOString(),
        status: "planned",
        visibility: "private",
        exercise_count: 0,
      });
      response.total = response.data.length;
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      dragHandleTo(handle, dayCell(evening));

      expect(dayCell(evening)).toHaveClass("calendar-month__cell--conflict");
      release(handle);

      expect(
        await screen.findByText("calendarSurface.schedule.errors.conflict"),
      ).toBeInTheDocument();
      expect(mockedUpdateSession).not.toHaveBeenCalled();
      expect(dayCell(evening)).toHaveClass("calendar-month__cell--conflict");
    });

    it("refuses a move into the time a longer session still occupies", async () => {
      // Tomorrow's 09:00 plan runs until 11:00; a move to 10:00 overlaps it.
      response.data[2] = { ...response.data[2], planned_duration_min: 120 };
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      fireEvent.click(handle);
      fireEvent.change(await screen.findByLabelText("calendarSurface.schedule.fields.day"), {
        target: { value: localDateKey(tomorrow) },
      });
      fireEvent.change(screen.getByLabelText("calendarSurface.schedule.fields.time"), {
        target: { value: "10:00" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "calendarSurface.schedule.actions.save" }),
      );

      expect(
        await screen.findByText("calendarSurface.schedule.errors.conflict"),
      ).toBeInTheDocument();
      expect(mockedUpdateSession).not.toHaveBeenCalled();
    });

    it("reports a conflict the server found outside the loaded sessions", async () => {
      mockedUpdateSession.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            error: {
              code: "E.SESSION.SCHEDULE_CONFLICT",
              details: { conflictingSessionIds: ["not-loaded"] },
            },
          },
        },
      });
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      dragHandleTo(handle, dayCell(addDays(today, 3)));
      release(handle);

      expect(
        await screen.findByText("calendarSurface.schedule.errors.conflictUnlisted"),
      ).toBeInTheDocument();
      expect(apiErrorSpy).not.toHaveBeenCalled();
    });

    it("ignores a drop back onto the session's own day", async () => {
      renderCalendar();
      const [handle] = await screen.findAllByRole("button", { name: MOVE });

      dragHandleTo(handle, dayCell(today));
      release(handle);

      expect(mockedUpdateSession).not.toHaveBeenCalled();
    });

    describe("week and day views (US-4.3-AC04)", () => {
      const slotCell = (date: Date, hour: number) => {
        const key = `${localDateKey(date)}T${String(hour).padStart(2, "0")}`;
        const cell = document.querySelector(`[data-schedule-day="${key}"]`);
        if (!cell) {
          throw new Error(`No time slot ${key}`);
        }
        return cell;
      };

      const chipFor = (sessionId: string) => {
        const chip = document.querySelector<HTMLElement>(
          `.schedule-time-grid [data-schedule-handle="${sessionId}"]`,
        );
        if (!chip) {
          throw new Error(`No chip for ${sessionId}`);
        }
        return chip;
      };

      it("switches between month, week and day views", async () => {
        renderCalendar();
        await screen.findAllByRole("button", { name: MOVE });
        const views = screen.getByRole("group", { name: "calendarSurface.views.label" });
        expect(
          within(views).getByRole("button", { name: "calendarSurface.views.month" }),
        ).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(within(views).getByRole("button", { name: "calendarSurface.views.week" }));

        const week = screen.getByRole("table", { name: "calendarSurface.timeGrid.weekLabel" });
        expect(screen.queryByRole("grid")).not.toBeInTheDocument();
        // A time column header plus seven day columns.
        expect(within(week).getAllByRole("columnheader")).toHaveLength(8);
        expect(slotCell(today, 18)).toContainElement(chipFor("planned-today"));
        expect(
          within(slotCell(today, 18) as HTMLElement).getByText("Today Plan"),
        ).toBeInTheDocument();

        fireEvent.click(within(views).getByRole("button", { name: "calendarSurface.views.day" }));

        const day = screen.getByRole("table", { name: "calendarSurface.timeGrid.dayLabel" });
        expect(within(day).getAllByRole("columnheader")).toHaveLength(2);
        expect(slotCell(today, 18)).toContainElement(chipFor("planned-today"));
      });

      it("shows completed sessions in their slot without a move control", async () => {
        renderCalendar();
        await screen.findAllByRole("button", { name: MOVE });
        fireEvent.click(screen.getByRole("button", { name: "calendarSurface.views.day" }));
        fireEvent.click(
          screen.getByRole("button", { name: "calendarSurface.navigation.previousDay" }),
        );

        const yesterdaySlot = slotCell(addDays(today, -1), 9) as HTMLElement;
        expect(within(yesterdaySlot).getByText("Completed Strength")).toBeInTheDocument();
        expect(within(yesterdaySlot).queryByRole("button")).not.toBeInTheDocument();
      });

      it("drags a chip onto another hour, keeping its minutes", async () => {
        response.data[1] = {
          ...response.data[1],
          planned_at: atLocalHour(today, 18, 30).toISOString(),
        };
        renderCalendar();
        await screen.findAllByRole("button", { name: MOVE });
        fireEvent.click(screen.getByRole("button", { name: "calendarSurface.views.week" }));

        const chip = chipFor("planned-today");
        dragHandleTo(chip, slotCell(today, 7));
        expect(slotCell(today, 7)).toHaveClass("schedule-time-grid__slot--drop-target");
        release(chip);

        await waitFor(() => {
          expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
            planned_at: atLocalHour(today, 7, 30).toISOString(),
          });
        });
      });
    });

    describe("session length (US-4.4-AC01)", () => {
      const slotCell = (date: Date, hour: number) => {
        const key = `${localDateKey(date)}T${String(hour).padStart(2, "0")}`;
        return document.querySelector(`[data-schedule-day="${key}"]`) as HTMLElement;
      };

      const resizeHandle = (sessionId: string) =>
        document.querySelector<HTMLElement>(`[data-schedule-resize="${sessionId}"]`)!;

      const openWeek = async () => {
        renderCalendar();
        await screen.findAllByRole("button", { name: MOVE });
        fireEvent.click(screen.getByRole("button", { name: "calendarSurface.views.week" }));
      };

      it("shows the time range and marks the later hours a session occupies", async () => {
        response.data[1] = { ...response.data[1], planned_duration_min: 120 };
        await openWeek();

        const range = new Intl.DateTimeFormat("en", { timeStyle: "short" }).formatRange(
          atLocalHour(today, 18),
          atLocalHour(today, 20),
        );
        expect(slotCell(today, 18).querySelector(".schedule-chip__time")).toHaveTextContent(range, {
          normalizeWhitespace: false,
        });
        expect(slotCell(today, 19).querySelector(".schedule-chip-continuation")).not.toBeNull();
        expect(slotCell(today, 20).querySelector(".schedule-chip-continuation")).toBeNull();
        expect(resizeHandle("planned-today")).toHaveAccessibleName(
          "calendarSurface.schedule.resizeLabel",
        );
      });

      it("offers no resize handle on completed sessions", async () => {
        await openWeek();
        expect(resizeHandle("completed-1")).toBeNull();
      });

      it("drags the resize handle to a later hour and saves the new length", async () => {
        await openWeek();
        const handle = resizeHandle("planned-today");

        dragHandleTo(handle, slotCell(today, 19));
        expect(handle.closest(".schedule-chip-group")?.firstElementChild).toHaveClass(
          "schedule-chip--resizing",
        );
        // The pending end already shows in the grid.
        expect(slotCell(today, 19).querySelector(".schedule-chip-continuation")).not.toBeNull();
        release(handle);

        await waitFor(() => {
          expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
            planned_duration_min: 120,
          });
        });
        expect(status()).toHaveTextContent("calendarSurface.schedule.status.rescheduled");
      });

      it("previews and refuses a resize into the next session", async () => {
        response.data.push({
          id: "planned-later",
          owner_id: "user-1",
          title: "Later Plan",
          planned_at: atLocalHour(today, 19, 30).toISOString(),
          planned_duration_min: 30,
          status: "planned",
          visibility: "private",
          exercise_count: 0,
        });
        response.total = response.data.length;
        await openWeek();
        const handle = resizeHandle("planned-today");

        dragHandleTo(handle, slotCell(today, 19));
        expect(slotCell(today, 19)).toHaveClass("schedule-time-grid__slot--conflict");
        release(handle);

        expect(
          await screen.findByText("calendarSurface.schedule.errors.conflict"),
        ).toBeInTheDocument();
        expect(mockedUpdateSession).not.toHaveBeenCalled();
      });

      it("resizes with Space and the arrow keys and returns focus to the resize handle", async () => {
        await openWeek();
        const handle = resizeHandle("planned-today");
        handle.focus();

        fireEvent.keyDown(handle, { key: " " });
        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.resizePickedUp");
        fireEvent.keyDown(handle, { key: "ArrowDown" });
        fireEvent.keyDown(handle, { key: "ArrowDown" });
        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.resizeOver");
        fireEvent.keyDown(handle, { key: "Enter" });

        await waitFor(() => {
          expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
            planned_duration_min: 90,
          });
        });
        await waitFor(() => {
          expect(document.activeElement).toHaveAttribute("data-schedule-resize", "planned-today");
        });
      });

      it("cancels a keyboard resize with Escape", async () => {
        await openWeek();
        const handle = resizeHandle("planned-today");
        handle.focus();

        fireEvent.keyDown(handle, { key: " " });
        fireEvent.keyDown(handle, { key: "ArrowUp" });
        fireEvent.keyDown(handle, { key: "Escape" });

        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.resizeCancelled");
        expect(mockedUpdateSession).not.toHaveBeenCalled();
      });
    });

    describe("keyboard pick-up (US-13.3-AC01)", () => {
      it("picks up with Space, moves a day with the arrow keys and drops with Enter", async () => {
        renderCalendar();
        const [handle] = await screen.findAllByRole("button", { name: MOVE });
        handle.focus();

        fireEvent.keyDown(handle, { key: " " });
        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.pickedUp");
        fireEvent.keyDown(handle, { key: "ArrowRight" });
        expect(dayCell(tomorrow)).toHaveClass("calendar-month__cell--drop-target");
        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.over");
        fireEvent.keyDown(handle, { key: "Enter" });

        await waitFor(() => {
          expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
            planned_at: atLocalHour(tomorrow, 18).toISOString(),
          });
        });
        expect(screen.queryByText("calendarSurface.schedule.dialog.title")).not.toBeInTheDocument();
      });

      it("moves by an hour in the week view and returns focus to the moved session", async () => {
        renderCalendar();
        await screen.findAllByRole("button", { name: MOVE });
        fireEvent.click(screen.getByRole("button", { name: "calendarSurface.views.week" }));
        const chip = document.querySelector<HTMLElement>(
          '.schedule-time-grid [data-schedule-handle="planned-today"]',
        )!;
        chip.focus();

        fireEvent.keyDown(chip, { key: " " });
        fireEvent.keyDown(chip, { key: "ArrowUp" });
        fireEvent.keyDown(chip, { key: "ArrowUp" });
        fireEvent.keyDown(chip, { key: "Enter" });

        await waitFor(() => {
          expect(mockedUpdateSession).toHaveBeenCalledWith("planned-today", {
            planned_at: atLocalHour(today, 16).toISOString(),
          });
        });
        await waitFor(() => {
          expect(document.activeElement).toHaveAttribute("data-schedule-handle", "planned-today");
        });
      });

      it("announces a conflict while moving and cancels with Escape", async () => {
        const evening = addDays(today, 2);
        response.data.push({
          id: "planned-evening",
          owner_id: "user-1",
          title: "Evening Plan",
          planned_at: atLocalHour(evening, 18).toISOString(),
          status: "planned",
          visibility: "private",
          exercise_count: 0,
        });
        response.total = response.data.length;
        renderCalendar();
        const [handle] = await screen.findAllByRole("button", { name: MOVE });
        handle.focus();

        fireEvent.keyDown(handle, { key: " " });
        fireEvent.keyDown(handle, { key: "ArrowRight" });
        fireEvent.keyDown(handle, { key: "ArrowRight" });

        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.overConflict");
        expect(dayCell(evening)).toHaveClass("calendar-month__cell--conflict");

        fireEvent.keyDown(handle, { key: "Escape" });

        expect(status()).toHaveTextContent("calendarSurface.schedule.keyboard.cancelled");
        expect(dayCell(evening)).not.toHaveClass("calendar-month__cell--conflict");
        expect(mockedUpdateSession).not.toHaveBeenCalled();
      });

      it("leaves Enter to the handle's click while nothing is picked up, opening the dialog", async () => {
        renderCalendar();
        const [handle] = await screen.findAllByRole("button", { name: MOVE });
        handle.focus();

        // Browsers turn an unhandled Enter on a button into a click.
        const enterHandled = !fireEvent.keyDown(handle, { key: "Enter" });
        fireEvent.click(handle);

        expect(enterHandled).toBe(false);
        expect(
          await screen.findByText("calendarSurface.schedule.dialog.title"),
        ).toBeInTheDocument();
      });
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
