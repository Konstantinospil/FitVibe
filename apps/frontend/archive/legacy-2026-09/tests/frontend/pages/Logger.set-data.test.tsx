import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  renderLogger,
  mockSessionData,
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

describe("Logger - Set Data Updates", () => {
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

  it("updates set reps", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Find reps input by placeholder
    const repsInputs = screen.getAllByPlaceholderText("Reps");
    expect(repsInputs.length).toBeGreaterThan(0);
    fireEvent.change(repsInputs[0], { target: { value: "12" } });
    expect(repsInputs[0]).toHaveValue(12);

    unmount();
  });

  it("updates set weight", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Find weight input by placeholder
    const weightInputs = screen.getAllByPlaceholderText("Weight");
    expect(weightInputs.length).toBeGreaterThan(0);
    fireEvent.change(weightInputs[0], { target: { value: "100" } });
    expect(weightInputs[0]).toHaveValue(100);

    unmount();
  });

  it("updates set RPE", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Find RPE input by placeholder
    const rpeInputs = screen.getAllByPlaceholderText("RPE");
    expect(rpeInputs.length).toBeGreaterThan(0);
    fireEvent.change(rpeInputs[0], { target: { value: "8" } });
    expect(rpeInputs[0]).toHaveValue(8);

    unmount();
  });

  // Note: Logger component doesn't have a notes input field for individual sets
  // Exercise-level notes exist but are not editable in the Logger component
});

