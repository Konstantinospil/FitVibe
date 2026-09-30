import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionCalendar } from "../../src/components/sessions/SessionCalendar";
import type { SessionWithExercises } from "../../src/services/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeSession(id: string, plannedAt: string, title: string): SessionWithExercises {
  return {
    id,
    owner_id: "user-1",
    title,
    planned_at: plannedAt,
    status: "planned",
    visibility: "private",
    exercises: [],
  };
}

describe("SessionCalendar", () => {
  it("navigates months, selects a date, and opens sessions", () => {
    const currentMonth = new Date(2026, 0, 1);
    const day = 15;
    const dateKey = new Date(2026, 0, day).toISOString().split("T")[0];
    const onMonthChange = vi.fn();
    const onDateClick = vi.fn();
    const onSessionClick = vi.fn();

    render(
      <SessionCalendar
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
        onDateClick={onDateClick}
        onSessionClick={onSessionClick}
        sessions={[
          makeSession("s-1", `${dateKey}T12:00:00.000Z`, "AM"),
          makeSession("s-2", `${dateKey}T13:00:00.000Z`, "Noon"),
          makeSession("s-3", `${dateKey}T14:00:00.000Z`, "PM"),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "calendar.previousMonth" }));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2025, 11, 1));
    fireEvent.click(screen.getByRole("button", { name: "calendar.nextMonth" }));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 1, 1));

    fireEvent.click(screen.getByText("15"));
    expect(onDateClick).toHaveBeenCalled();
    expect(screen.getByText("+1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AM"));
    expect(onSessionClick).toHaveBeenCalledWith("s-1");

    fireEvent.keyDown(screen.getByText("Noon"), { key: "Enter" });
    expect(onSessionClick).toHaveBeenCalledWith("s-2");
    fireEvent.keyDown(screen.getByText("Noon"), { key: " " });
    expect(onSessionClick).toHaveBeenCalledWith("s-2");
    fireEvent.keyDown(screen.getByText("Noon"), { key: "Tab" });
  });
});
