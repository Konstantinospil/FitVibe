import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionLogger } from "../../src/components/sessions/SessionLogger";
import type { SessionWithExercises } from "../../src/services/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeSession(exercises: SessionWithExercises["exercises"] = []): SessionWithExercises {
  return {
    id: "session-1",
    owner_id: "user-1",
    title: "Push",
    planned_at: "2026-01-01T10:00:00.000Z",
    status: "in_progress",
    visibility: "private",
    exercises,
  };
}

describe("SessionLogger", () => {
  it("shows empty state when the session has no exercises", () => {
    render(<SessionLogger session={makeSession()} />);
    expect(screen.getByText("logger.noExercises")).toBeInTheDocument();
  });

  it("steps through exercises, updates sets, and completes", () => {
    const onExerciseUpdate = vi.fn();
    const onComplete = vi.fn();
    const session = makeSession([
      {
        id: "ex-sets",
        session_id: "session-1",
        order_index: 0,
        sets: [
          {
            id: "set-1",
            order_index: 1,
            reps: 8,
            weight_kg: 60,
            rpe: 7,
            notes: "paused",
          },
        ],
      },
      {
        id: "ex-planned",
        session_id: "session-1",
        order_index: 1,
        sets: [],
        planned: { sets: 2, reps: 10, load: 40, rpe: 6 },
      },
      {
        id: "ex-empty",
        session_id: "session-1",
        order_index: 2,
        sets: [],
      },
    ]);

    render(
      <SessionLogger
        session={session}
        onExerciseUpdate={onExerciseUpdate}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("8"), { target: { value: "9" } });
    expect(onExerciseUpdate).toHaveBeenCalledWith(
      "ex-sets",
      expect.arrayContaining([expect.objectContaining({ reps: 9 })]),
    );

    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    const stepButtons = screen.getAllByRole("button", { name: /logger.goToExercise/ });
    fireEvent.click(stepButtons[2]);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "logger.complete" }));
    expect(onComplete).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "common.previous" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
