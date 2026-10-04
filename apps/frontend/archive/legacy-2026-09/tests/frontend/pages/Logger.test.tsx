import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Logger from "../../src/pages/Logger";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as api from "../../src/services/api";
import { ToastProvider } from "../../src/contexts/ToastContext";

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getSession: vi.fn(),
    updateSession: vi.fn(),
  };
});

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  initImmediate: false,
  resources: {
    en: {
      translation: {
        "logger.eyebrow": "Workout",
        "logger.title": "Logger",
        "logger.description": "Log your workout",
        "logger.sessionTime": "Session time",
        "logger.restTimer": "Rest Timer",
        "logger.stopRest": "Stop Rest",
        "logger.startRest": "Start Rest",
        "logger.completeSession": "Complete Session",
        "logger.completing": "Completing...",
        "logger.setsCompleted": "sets completed",
        "logger.exercises": "exercises",
        "logger.markComplete": "Mark complete",
        "logger.markIncomplete": "Mark incomplete",
        "logger.repsPlaceholder": "Reps",
        "logger.weightPlaceholder": "Weight",
        "logger.rpePlaceholder": "RPE",
        "logger.visibilitySettings": "Session Visibility",
        "logger.currentVisibility": "Current visibility",
        "logger.visibilityUpdated": "Session visibility updated",
        "logger.visibilityUpdateFailed": "Failed to update visibility",
        "logger.visibilityLabel": "Change session visibility",
        "logger.visibilityPrivate": "Private",
        "logger.visibilityLink": "Link only",
        "logger.visibilityPublic": "Public",
        "logger.visibilityHelp":
          "Private sessions are only visible to you. Link sessions can be shared via link. Public sessions appear in the community feed.",
        "logger.collapse": "Collapse",
        "logger.expand": "Expand",
        "logger.customExercise": "Custom Exercise",
        "logger.workoutSession": "Workout Session",
        "common.loading": "Loading...",
      },
    },
  },
});

const renderLogger = (sessionId: string = "test-session-id") => {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/logger/${sessionId}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/logger/:sessionId" element={<Logger />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const mockSessionData = {
  id: "test-session-id",
  owner_id: "user-1",
  title: "Test Workout",
  planned_at: "2024-01-15T10:00:00Z",
  status: "planned" as const,
  visibility: "private" as const,
  exercises: [
    {
      id: "ex-1",
      exercise_id: "bench-press",
      order_index: 0,
      notes: "Warm up first",
      planned: {
        sets: 3,
        reps: 10,
        load: 80,
        rpe: 7,
      },
      sets: [],
    },
  ],
};

const mockSessionWithSets = {
  ...mockSessionData,
  status: "in_progress" as const,
  started_at: "2024-01-15T10:05:00Z",
  exercises: [
    {
      id: "ex-1",
      exercise_id: "bench-press",
      order_index: 0,
      notes: "Working sets",
      planned: {
        sets: 2,
        reps: 8,
        load: 90,
        rpe: 8,
      },
      sets: [
        {
          order_index: 0,
          reps: 8,
          weight_kg: 95,
          rpe: 8,
          notes: "Felt good",
        },
      ],
    },
  ],
};

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders logger page and loads session", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(api.getSession).toHaveBeenCalledWith("test-session-id");
    expect(screen.getByText(/bench-press/i)).toBeInTheDocument();
  });

  it("shows loading state while fetching session", () => {
    vi.mocked(api.getSession).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    renderLogger();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows toast and navigates when session load fails", async () => {
    vi.mocked(api.getSession).mockRejectedValue(new Error("Failed to load"));

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Failed to load session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/sessions");
      },
      { timeout: 5000 },
    );
  });

  it("navigates to sessions if no sessionId provided", () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/logger/"]}>
          <I18nextProvider i18n={testI18n}>
            <Routes>
              <Route path="/logger/" element={<Logger />} />
            </Routes>
          </I18nextProvider>
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/sessions");
  });

  it("updates session status to in_progress when starting", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(api.updateSession).toHaveBeenCalledWith("test-session-id", {
      status: "in_progress",
      started_at: expect.any(String),
    });
  });

  it("displays complete session button", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const completeButtons = screen.getAllByText("Complete Session");
    expect(completeButtons.length).toBeGreaterThan(0);
  });

  it("shows confirmation dialog when completing session", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Mark a set as completed first (needed to enable the button)
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    await waitFor(
      () => {
        const completeButtons = screen.getAllByText("Complete Session");
        // Click the first Complete Session button
        fireEvent.click(completeButtons[0]);
      },
      { timeout: 5000 },
    );

    // Wait for confirmation dialog to appear
    await waitFor(
      () => {
        expect(screen.getByText(/complete this session/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("uses existing set data when provided", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionWithSets as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const repsInput = screen.getAllByPlaceholderText("Reps")[0];
    const weightInput = screen.getByPlaceholderText("Weight");
    const rpeInput = screen.getByPlaceholderText("RPE");

    expect(repsInput).toHaveValue(8);
    expect(weightInput).toHaveValue(95);
    expect(rpeInput).toHaveValue(8);
    expect(api.updateSession).not.toHaveBeenCalledWith(
      "test-session-id",
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  it("toggles exercise collapse state", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText("Reps")).toBeInTheDocument();

    const collapseButton = screen.getByRole("button", { name: "Collapse" });
    fireEvent.click(collapseButton);

    expect(screen.queryByText("Reps")).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: "Expand" });
    fireEvent.click(expandButton);

    expect(screen.getByText("Reps")).toBeInTheDocument();
  });

  it("starts and stops the rest timer from controls", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const startButton = screen.getByRole("button", { name: /Start Rest/i });
    fireEvent.click(startButton);

    expect(screen.getByText("Rest Timer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop Rest/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Stop Rest/i }));

    expect(screen.queryByText("Rest Timer")).not.toBeInTheDocument();
  });

  it("toggles set completion and disables inputs", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const repsInput = screen.getAllByPlaceholderText("Reps")[0];
    const completeButton = screen.getAllByLabelText(/Mark complete/i)[0];

    fireEvent.click(completeButton);
    expect(repsInput).toBeDisabled();
    expect(screen.getAllByLabelText(/Mark incomplete/i)[0]).toBeInTheDocument();
  });

  it("completes session when confirmed in dialog", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    await waitFor(
      () => {
        const completeButtons = screen.getAllByText("Complete Session");
        fireEvent.click(completeButtons[0]);
      },
      { timeout: 5000 },
    );

    // Wait for confirmation dialog
    await waitFor(
      () => {
        expect(screen.getByText(/complete this session/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click confirm button
    const confirmButtons = screen.getAllByText("Yes, Complete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Verify API call
    await waitFor(
      () => {
        expect(api.updateSession).toHaveBeenCalledWith(
          "test-session-id",
          expect.objectContaining({
            status: "completed",
            completed_at: expect.any(String),
            exercises: expect.any(Array),
          }),
        );
      },
      { timeout: 5000 },
    );

    // Verify success toast
    await waitFor(
      () => {
        expect(screen.getByText("Session completed successfully!")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify navigation
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/sessions");
      },
      { timeout: 5000 },
    );
  });

  it("does not complete session when cancelled in dialog", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    // Clear the mock to only track complete calls
    vi.mocked(api.updateSession).mockClear();

    await waitFor(
      () => {
        const completeButtons = screen.getAllByText("Complete Session");
        fireEvent.click(completeButtons[0]);
      },
      { timeout: 5000 },
    );

    // Wait for confirmation dialog
    await waitFor(
      () => {
        expect(screen.getByText(/complete this session/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click cancel button
    fireEvent.click(screen.getByText("Cancel"));

    // Verify dialog is closed
    await waitFor(
      () => {
        expect(screen.queryByText(/complete this session/i)).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify updateSession was NOT called for completion
    expect(api.updateSession).not.toHaveBeenCalled();
  });

  it("shows error message when session completion fails", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValueOnce({} as any); // For starting session
    vi.mocked(api.updateSession).mockRejectedValueOnce(new Error("Completion failed")); // For completing

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Mark a set as completed first
    const checkboxes = screen.getAllByLabelText(/Mark complete/i);
    fireEvent.click(checkboxes[0]);

    await waitFor(
      () => {
        const completeButtons = screen.getAllByText("Complete Session");
        fireEvent.click(completeButtons[0]);
      },
      { timeout: 5000 },
    );

    // Wait for confirmation dialog
    await waitFor(
      () => {
        expect(screen.getByText(/complete this session/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click confirm button
    const confirmButtons = screen.getAllByText("Yes, Complete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Verify error message appears
    await waitFor(
      () => {
        expect(
          screen.getByText("Failed to complete session. Please try again."),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("renders a custom exercise label when exercise_id is missing", async () => {
    vi.mocked(api.getSession).mockResolvedValue({
      ...mockSessionData,
      exercises: [
        {
          ...mockSessionData.exercises[0],
          exercise_id: null,
        },
      ],
    } as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText(/Custom Exercise/i)).toBeInTheDocument();
  });

  it("falls back to default session title when none is provided", async () => {
    vi.mocked(api.getSession).mockResolvedValue({
      ...mockSessionData,
      title: null,
    } as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Workout Session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("clears RPE when value is out of range", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const rpeInput = screen.getAllByPlaceholderText("RPE")[0] as HTMLInputElement;
    fireEvent.change(rpeInput, { target: { value: "11" } });

    await waitFor(() => {
      expect(rpeInput.value).toBe("");
    });
  });

  it("accepts RPE when value is within range", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const rpeInput = screen.getAllByPlaceholderText("RPE")[0] as HTMLInputElement;
    fireEvent.change(rpeInput, { target: { value: "5" } });

    await waitFor(() => {
      expect(rpeInput.value).toBe("5");
    });
  });

  it("formats session timer with hours when elapsed exceeds an hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T11:00:00Z"));
    vi.mocked(api.getSession).mockResolvedValue({
      ...mockSessionData,
      status: "in_progress",
      started_at: "2024-01-15T10:00:00Z",
    } as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await flushPromises();
    await flushPromises();
    expect(screen.getByText("Test Workout")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1:00:01")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("auto-starts rest timer on set completion and vibrates when it finishes", async () => {
    vi.useFakeTimers();
    const originalVibrate = navigator.vibrate;
    const vibrateSpy = vi.fn();
    (navigator as any).vibrate = vibrateSpy;

    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await flushPromises();
    await flushPromises();
    expect(screen.getByText("Test Workout")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText(/Mark complete/i)[0]);
    });

    expect(screen.getByText("Rest Timer")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(90_000);
    });

    expect(screen.queryByText("Rest Timer")).not.toBeInTheDocument();
    expect(vibrateSpy).toHaveBeenCalled();

    (navigator as any).vibrate = originalVibrate;
    vi.useRealTimers();
  });

  it("clears reps and weight inputs when zero is entered", async () => {
    vi.mocked(api.getSession).mockResolvedValue(mockSessionData as any);
    vi.mocked(api.updateSession).mockResolvedValue({} as any);

    renderLogger();

    await waitFor(
      () => {
        expect(screen.getByText("Test Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const repsInput = screen.getAllByPlaceholderText("Reps")[0] as HTMLInputElement;
    const weightInput = screen.getAllByPlaceholderText("Weight")[0] as HTMLInputElement;

    fireEvent.change(repsInput, { target: { value: "0" } });
    fireEvent.change(weightInput, { target: { value: "0" } });

    await waitFor(() => {
      expect(repsInput.value).toBe("");
      expect(weightInput.value).toBe("");
    });
  });
});
