import { screen, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nextProvider } from "react-i18next";
import Logger from "../../src/pages/Logger";
import { ToastProvider } from "../../src/contexts/ToastContext";
import {
  renderLogger,
  mockSessionData,
  mockNavigate,
  testI18n,
} from "./Logger.test.setup";
import { createControlledPromise } from "../helpers/testUtils";
import * as api from "../../src/services/api";

// Ensure API is mocked (mocks are hoisted, but we need to ensure it's applied)
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getSession: vi.fn(),
    updateSession: vi.fn(),
  };
});

// Ensure navigate is mocked
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Logger - Basic", () => {
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

  it("renders logger page and loads session", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    // Use findByText with timeout
    const title = await screen.findByText("Test Workout", { timeout: 5000 });
    expect(title).toBeInTheDocument();

    expect(api.getSession).toHaveBeenCalledWith("test-session-id");
    expect(screen.getByText(/bench-press/i)).toBeInTheDocument();

    unmount();
  });

  it("shows loading state while fetching session", async () => {
    // Create a controlled promise to test loading state without hanging
    const { promise, resolve } = createControlledPromise<any>();

    vi.mocked(api.getSession).mockImplementation(() => promise);

    const { unmount } = renderLogger();

    // Should show loading state
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Resolve the promise to prevent hanging
    resolve(mockSessionData);
    await promise;

    // Clean up: unmount component to prevent any timers from keeping process alive
    unmount();
  });

  it("shows toast and navigates when session load fails", async () => {
    vi.mocked(api.getSession).mockRejectedValue(new Error("Failed to load"));

    const { unmount } = renderLogger();

    // Use findByText for async content - wait for error toast
    const errorMessage = await screen.findByText("Failed to load session", { timeout: 10000 });
    expect(errorMessage).toBeInTheDocument();

    // Navigation should happen - wait for it with longer timeout
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/sessions");
      },
      { timeout: 10000 },
    );

    unmount();
  });

  it("navigates to sessions if no sessionId provided", async () => {
    const { unmount } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/logger"]}>
          <I18nextProvider i18n={testI18n}>
            <Routes>
              <Route path="/logger" element={<Logger />} />
            </Routes>
          </I18nextProvider>
        </MemoryRouter>
      </ToastProvider>,
    );

    // Navigation happens asynchronously in useEffect
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/sessions");
      },
      { timeout: 10000 },
    );

    unmount();
  });

  it("updates session status to in_progress when starting", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout", { timeout: 5000 });

    // Wait for updateSession to be called (it's called after session loads)
    await waitFor(
      () => {
        expect(api.updateSession).toHaveBeenCalledWith("test-session-id", {
          status: "in_progress",
          started_at: expect.any(String),
        });
      },
      { timeout: 5000 },
    );

    unmount();
  });

  it("displays complete session button", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    const { unmount } = renderLogger();

    await screen.findByText("Test Workout", { timeout: 5000 });

    const completeButtons = screen.getAllByText("Complete Session");
    expect(completeButtons.length).toBeGreaterThan(0);

    unmount();
  });

  describe("session status handling", () => {
    it("handles session with in_progress status", async () => {
      const inProgressSession = {
        ...mockSessionData,
        status: "in_progress" as const,
        started_at: new Date().toISOString(),
      };

      vi.mocked(api.getSession).mockResolvedValue(inProgressSession as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout", { timeout: 5000 });

      // Wait a bit to ensure updateSession is not called
      await waitFor(
        () => {
          // Should not call updateSession to start (already started)
          const calls = vi.mocked(api.updateSession).mock.calls;
          const startCalls = calls.filter(
            (call) =>
              call[0] === "test-session-id" &&
              call[1] &&
              typeof call[1] === "object" &&
              "status" in call[1] &&
              call[1].status === "in_progress",
          );
          expect(startCalls.length).toBe(0);
        },
        { timeout: 2000 },
      );

      unmount();
    });

    it("handles session with completed status", async () => {
      const completedSession = {
        ...mockSessionData,
        status: "completed" as const,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date().toISOString(),
      };

      vi.mocked(api.getSession).mockResolvedValue(completedSession as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout", { timeout: 5000 });

      unmount();
    });
  });

  describe("session timer", () => {
    it("displays session elapsed time", async () => {
      vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
      vi.mocked(api.updateSession).mockResolvedValue({} as any);

      const { unmount } = renderLogger();

      await screen.findByText("Test Workout", { timeout: 5000 });

      // Timer should be displayed (component creates interval on mount)
      // Wait a bit for timer to update
      await waitFor(
        () => {
          const timerElements = screen.getAllByText(/\d+:\d+/);
          expect(timerElements.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      unmount();
    });
  });
});

