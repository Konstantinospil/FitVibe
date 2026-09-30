import { screen, fireEvent } from "@testing-library/react";
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

describe("Logger - Completion", () => {
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

  it("shows confirmation dialog when completing session", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Mark a set as completed first (needed to enable the button)
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Click the first Complete Session button
    const completeButtons = screen.getAllByText("Complete Session");
    fireEvent.click(completeButtons[0]);

    // Wait for confirmation dialog to appear using findByText
    const dialog = await screen.findByText(/complete this session/i);
    expect(dialog).toBeInTheDocument();

    unmount();
  });

  it("completes session when confirmed in dialog", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Complete session
    const completeButtons = screen.getAllByText("Complete Session");
    fireEvent.click(completeButtons[0]);

    // Wait for confirmation dialog
    await screen.findByText(/complete this session/i);

    // Click confirm button
    const confirmButtons = screen.getAllByText("Yes, Complete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Verify API call
    expect(api.updateSession).toHaveBeenCalledWith(
      "test-session-id",
      expect.objectContaining({
        status: "completed",
        completed_at: expect.any(String),
        exercises: expect.any(Array),
      }),
    );

    // Verify success toast
    const successMessage = await screen.findByText("Session completed successfully!");
    expect(successMessage).toBeInTheDocument();

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith("/sessions");

    unmount();
  });

  it("does not complete session when cancelled in dialog", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Clear the mock to only track complete calls
    vi.mocked(api.updateSession).mockClear();

    // Click complete button
    const completeButtons = screen.getAllByText("Complete Session");
    fireEvent.click(completeButtons[0]);

    // Wait for confirmation dialog
    await screen.findByText(/complete this session/i);

    // Click cancel button
    fireEvent.click(screen.getByText("Cancel"));

    // Verify dialog is closed
    expect(screen.queryByText(/complete this session/i)).not.toBeInTheDocument();

    // Verify updateSession was NOT called for completion
    expect(api.updateSession).not.toHaveBeenCalled();

    unmount();
  });

  it("shows error message when session completion fails", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValueOnce({} as any); // For starting session
    vi.mocked(api.updateSession).mockRejectedValueOnce(new Error("Completion failed")); // For completing

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout");

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Click complete button
    const completeButtons = screen.getAllByText("Complete Session");
    fireEvent.click(completeButtons[0]);

    // Wait for confirmation dialog
    await screen.findByText(/complete this session/i);

    // Click confirm button
    const confirmButtons = screen.getAllByText("Yes, Complete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Verify error message appears
    const errorMessage = await screen.findByText("Failed to complete session. Please try again.");
    expect(errorMessage).toBeInTheDocument();

    unmount();
  });

  describe("complete session button state", () => {
    it("disables complete button when no sets are completed", async () => {
      vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      // Find the Complete Session button by role (there are two - one in header, one at bottom)
      // Both should be disabled when no sets are completed
      const completeButtons = screen.getAllByRole("button", { name: /Complete Session/i });
      expect(completeButtons.length).toBeGreaterThan(0);
      // Check the first button (header button)
      expect(completeButtons[0]).toBeDisabled();

      unmount();
    });

    it("enables complete button when at least one set is completed", async () => {
      vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      // Mark a set as completed
      const checkboxes = screen.getAllByLabelText(/Mark complete/i);
      fireEvent.click(checkboxes[0]);

      // Check button state - it should be enabled now
      const completeButtons = screen.getAllByRole("button", { name: /Complete Session/i });
      expect(completeButtons.length).toBeGreaterThan(0);
      // Check the first button (header button)
      expect(completeButtons[0]).not.toBeDisabled();

      unmount();
    });
  });

  describe("session completion payload", () => {
    it("includes all logged set data in completion payload", async () => {
      vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout");

      // Update set data
      const repsInputs = screen.getAllByPlaceholderText("Reps");
      expect(repsInputs.length).toBeGreaterThan(0);
      fireEvent.change(repsInputs[0], { target: { value: "12" } });

      const weightInputs = screen.getAllByPlaceholderText("Weight");
      expect(weightInputs.length).toBeGreaterThan(0);
      fireEvent.change(weightInputs[0], { target: { value: "100" } });

      // Mark set as completed
      const checkboxes = screen.getAllByLabelText(/Mark complete/i);
      fireEvent.click(checkboxes[0]);

      // Complete session
      const completeButtons = screen.getAllByText("Complete Session");
      fireEvent.click(completeButtons[0]);

      // Wait for dialog and confirm
      await screen.findByText(/complete this session/i);
      const confirmButtons = screen.getAllByText("Yes, Complete Session");
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);

      // Verify API call
      expect(api.updateSession).toHaveBeenCalledWith(
        "test-session-id",
        expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              sets: expect.arrayContaining([
                expect.objectContaining({
                  reps: expect.any(Number),
                  weight_kg: expect.any(Number),
                }),
              ]),
            }),
          ]),
        }),
      );

      unmount();
    });
  });
});

