import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderLogger, mockSessionData } from "./Logger.test.setup";
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

describe("Logger - Exercise Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.vibrate to prevent errors
    if (!("vibrate" in navigator)) {
      Object.defineProperty(navigator, "vibrate", {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  it("toggles exercise collapse/expand", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    const collapseButton = screen.getByLabelText(/Collapse|Expand/i);
    fireEvent.click(collapseButton);
    expect(collapseButton).toHaveAttribute("aria-label", "Expand");

    unmount();
  });

  describe("exercise log initialization", () => {
    it("initializes logs from existing sets", async () => {
      const sessionWithSets = {
        ...mockSessionData,
        exercises: [
          {
            id: "ex-1",
            exercise_id: "bench-press",
            order_index: 0,
            notes: null,
            planned: { sets: 3, reps: 10, load: 80, rpe: 7 },
            sets: [
              { order_index: 0, reps: 10, weight_kg: 80, rpe: 7, notes: null },
              { order_index: 1, reps: 10, weight_kg: 80, rpe: 7, notes: null },
            ],
          },
        ],
      };

      vi.mocked(api.getSession).mockResolvedValue(sessionWithSets as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      // Should have 2 sets initialized from existing sets
      const repsInputs = screen.getAllByPlaceholderText("Reps");
      expect(repsInputs.length).toBeGreaterThanOrEqual(2);

      unmount();
    });

    it("initializes logs from planned data when no sets exist", async () => {
      const sessionWithPlanned = {
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
        ],
      };

      vi.mocked(api.getSession).mockResolvedValue(sessionWithPlanned as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      // Should have 3 sets initialized from planned data
      const repsInputs = screen.getAllByPlaceholderText("Reps");
      expect(repsInputs.length).toBeGreaterThanOrEqual(3);

      unmount();
    });

    it("handles exercise with null exercise_id", async () => {
      const sessionWithNullExercise = {
        ...mockSessionData,
        exercises: [
          {
            id: "ex-1",
            exercise_id: null,
            order_index: 0,
            notes: null,
            planned: { sets: 3, reps: 10, load: 80, rpe: 7 },
            sets: [],
          },
        ],
      };

      vi.mocked(api.getSession).mockResolvedValue(sessionWithNullExercise as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      unmount();
    });
  });
});
