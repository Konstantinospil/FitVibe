import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../../src/components/sessions/SessionCard";

describe("SessionCard", () => {
  it("renders session details and action handlers", () => {
    const onStart = vi.fn();
    const onView = vi.fn();
    const onDelete = vi.fn();
    const session = {
      id: "session-1",
      title: "Leg Day",
      status: "planned",
      planned_at: "2025-01-01T10:00:00.000Z",
      exercises: Array.from({ length: 6 }).map((_, idx) => ({
        exercise_id: `exercise-${idx + 1}`,
      })),
      notes: "Bring water",
    };

    render(
      <SessionCard
        session={session as never}
        onStart={onStart}
        onView={onView}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Leg Day")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Start session"));
    fireEvent.click(screen.getByLabelText("View session"));
    fireEvent.click(screen.getByLabelText("Delete session"));

    expect(onStart).toHaveBeenCalledWith("session-1");
    expect(onView).toHaveBeenCalledWith("session-1");
    expect(onDelete).toHaveBeenCalledWith("session-1");
  });
});
