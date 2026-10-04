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

describe("Logger - Rest Timer", () => {
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

  it("starts rest timer when set is completed", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Mark a set as completed - should start rest timer
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Wait for rest timer to appear
    const restTimer = await screen.findByText(/Rest Timer/i);
    expect(restTimer).toBeInTheDocument();

    unmount();
  });

  it("stops rest timer when stop button is clicked", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Start rest timer
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Wait for rest timer to appear
    await screen.findByText(/Rest Timer/i);

    // Click stop button (should be available now)
    const stopButton = screen.getByText(/Stop Rest/i);
    fireEvent.click(stopButton);

    // Rest timer should be hidden - check immediately
    expect(screen.queryByText(/Rest Timer/i)).not.toBeInTheDocument();

    unmount();
  });

  it("starts rest timer manually", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Click start rest button
    const startRestButton = screen.getByText(/Start Rest/i);
    fireEvent.click(startRestButton);

    // Wait for rest timer to appear
    const restTimer = await screen.findByText(/Rest Timer/i);
    expect(restTimer).toBeInTheDocument();

    unmount();
  });
});

