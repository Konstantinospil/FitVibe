import { screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  renderLogger,
  mockSessionData,
  mockNavigate,
} from "./Logger.test.setup";
import * as api from "../../src/services/api";

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getSession: vi.fn(),
    updateSession: vi.fn(),
  };
});

describe("Logger - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Mock navigator.vibrate to prevent errors
    if (!("vibrate" in navigator)) {
      Object.defineProperty(navigator, "vibrate", {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  it("handles session without title", async () => {
    const sessionWithoutTitle = {
      ...mockSessionData,
      title: null,
    };

    vi.mocked(api.getSession).mockResolvedValue(sessionWithoutTitle as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    const title = await screen.findByText("Workout Session");
    expect(title).toBeInTheDocument();

    unmount();
  });

  it("handles session with multiple exercises", async () => {
    const multiExerciseSession = {
      ...mockSessionData,
      exercises: [
        {
          id: "ex-1",
          exercise_id: "bench-press",
          order_index: 0,
          notes: null,
          planned: { sets: 3, reps: 10, load: 80, rpe: 7 },
          sets: [],
        },
        {
          id: "ex-2",
          exercise_id: "squat",
          order_index: 1,
          notes: null,
          planned: { sets: 4, reps: 8, load: 120, rpe: 8 },
          sets: [],
        },
      ],
    };

    vi.mocked(api.getSession).mockResolvedValue(multiExerciseSession as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Should have multiple exercises
    const exerciseCards = screen.getAllByText(/Exercise|Set/i);
    expect(exerciseCards.length).toBeGreaterThan(0);

    unmount();
  });

  it("handles confirmCompleteSession when session is null", async () => {
    vi.mocked(api.getSession).mockRejectedValue(new Error("Session not found"));
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    // Should navigate away when session load fails
    await screen.findByText("Failed to load session");
    expect(mockNavigate).toHaveBeenCalledWith("/sessions");

    unmount();
  });
});

