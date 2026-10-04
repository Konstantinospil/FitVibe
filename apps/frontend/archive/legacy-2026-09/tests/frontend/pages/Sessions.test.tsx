import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Sessions from "../../src/pages/Sessions";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as api from "../../src/services/api";
import type { SessionWithExercises } from "../../src/services/api";
import { ToastProvider } from "../../src/contexts/ToastContext";

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
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
  resources: {
    en: {
      translation: {
        "sessions.eyebrow": "Workouts",
        "sessions.title": "My Sessions",
        "sessions.description": "Manage your workout sessions",
        "sessions.plannerTab": "Planner",
        "sessions.loggerTab": "Logger",
        "common.loading": "Loading...",
      },
    },
  },
});

const renderWithProviders = () => {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <I18nextProvider i18n={testI18n}>
          <Sessions />
        </I18nextProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
};

const mockSession = {
  id: "session-1",
  owner_id: "user-1",
  title: "Morning Workout",
  planned_at: "2024-01-15T10:00:00Z",
  status: "planned" as const,
  visibility: "private" as const,
  notes: "Chest and triceps",
  exercises: [
    {
      id: "exercise-1",
      session_id: "session-1",
      exercise_id: "bench-press",
      order_index: 0,
      sets: [],
    },
    {
      id: "exercise-2",
      session_id: "session-1",
      exercise_id: "tricep-dips",
      order_index: 1,
      sets: [],
    },
  ],
};

describe("Sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.mocked(api.listSessions).mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it("renders sessions page with tabs", async () => {
    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("My Sessions")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByRole("tab", { name: /planner/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /logger/i })).toBeInTheDocument();
  });

  it("loads planned sessions on mount", async () => {
    renderWithProviders();

    await waitFor(
      () => {
        expect(api.listSessions).toHaveBeenCalledWith({
          status: "planned",
          limit: 50,
        });
      },
      { timeout: 5000 },
    );
  });

  it("loads active sessions on mount", async () => {
    renderWithProviders();

    await waitFor(
      () => {
        expect(api.listSessions).toHaveBeenCalledWith({
          status: "in_progress",
          limit: 20,
        });
      },
      { timeout: 5000 },
    );
  });

  it("shows loading state while fetching planned sessions", () => {
    renderWithProviders();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays empty state when no planned sessions", async () => {
    vi.mocked(api.listSessions).mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("No planned sessions")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(
      screen.getByText("Create your first workout session to get started"),
    ).toBeInTheDocument();
  });

  it("displays planned sessions list", async () => {
    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText("Chest and triceps")).toBeInTheDocument();
    expect(screen.getByText("2 exercises")).toBeInTheDocument();
  });

  it("switches to logger tab when clicked", async () => {
    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByRole("tab", { name: /planner/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const loggerTab = screen.getByRole("tab", { name: /logger/i });
    fireEvent.click(loggerTab);

    await waitFor(
      () => {
        expect(loggerTab).toHaveAttribute("aria-selected", "true");
      },
      { timeout: 5000 },
    );
  });

  it("displays empty state for active sessions", async () => {
    vi.mocked(api.listSessions).mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByRole("tab", { name: /logger/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByRole("tab", { name: /logger/i }));

    await waitFor(
      () => {
        expect(screen.getByText("No active sessions")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays active sessions in logger tab", async () => {
    const activeSession = {
      ...mockSession,
      id: "active-1",
      title: "Active Workout",
      status: "in_progress" as const,
      started_at: "2024-01-15T10:30:00Z",
    };

    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "in_progress") {
        return Promise.resolve({
          data: [activeSession as SessionWithExercises],
          total: 1,
          limit: 20,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByRole("tab", { name: /logger/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByRole("tab", { name: /logger/i }));

    await waitFor(
      () => {
        expect(screen.getByText("Active Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
  });

  it("navigates to planner when create button clicked", async () => {
    vi.mocked(api.listSessions).mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Create New Session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByText("Create New Session"));

    expect(mockNavigate).toHaveBeenCalledWith("/planner");
  });

  it("navigates to logger when start button clicked", async () => {
    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const startButton = screen.getByLabelText("Start session");
    fireEvent.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith("/logger/session-1");
  });

  it("navigates to session detail when view button clicked", async () => {
    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const viewButton = screen.getByLabelText("View session");
    fireEvent.click(viewButton);

    expect(mockNavigate).toHaveBeenCalledWith("/sessions/session-1");
  });

  it("deletes session when delete button clicked and confirmed", async () => {
    vi.mocked(api.deleteSession).mockResolvedValue(undefined);

    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const deleteButton = screen.getByLabelText("Delete session");
    fireEvent.click(deleteButton);

    // Wait for confirmation dialog to appear
    await waitFor(
      () => {
        expect(screen.getByText("Delete Session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click the confirm button in the dialog
    const confirmButtons = screen.getAllByText("Yes, Delete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(
      () => {
        expect(api.deleteSession).toHaveBeenCalledWith("session-1");
      },
      { timeout: 5000 },
    );

    await waitFor(
      () => {
        expect(screen.queryByText("Morning Workout")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify success toast appears
    await waitFor(
      () => {
        expect(screen.getByText("Session deleted successfully")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("does not delete session when delete is cancelled", async () => {
    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const deleteButton = screen.getByLabelText("Delete session");
    fireEvent.click(deleteButton);

    // Wait for confirmation dialog to appear
    await waitFor(
      () => {
        expect(screen.getByText("Delete Session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click the cancel button in the dialog
    fireEvent.click(screen.getByText("Cancel"));

    // Verify dialog is closed
    await waitFor(
      () => {
        expect(screen.queryByText("Delete Session")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(api.deleteSession).not.toHaveBeenCalled();
    expect(screen.getByText("Morning Workout")).toBeInTheDocument();
  });

  it("shows toast when delete fails", async () => {
    vi.mocked(api.deleteSession).mockRejectedValue(new Error("Delete failed"));

    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const deleteButton = screen.getByLabelText("Delete session");
    fireEvent.click(deleteButton);

    // Wait for confirmation dialog to appear
    await waitFor(
      () => {
        expect(screen.getByText("Delete Session")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Click the confirm button in the dialog
    const confirmButtons = screen.getAllByText("Yes, Delete Session");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Verify error toast appears
    await waitFor(
      () => {
        expect(screen.getByText("Failed to delete session. Please try again.")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays exercise count for sessions", async () => {
    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [mockSession as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("2 exercises")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows up to 5 exercise names", async () => {
    const sessionWithManyExercises: typeof mockSession = {
      ...mockSession,
      exercises: [
        {
          id: "ex-1",
          session_id: "session-1",
          exercise_id: "exercise-1",
          order_index: 0,
          sets: [],
        },
        {
          id: "ex-2",
          session_id: "session-1",
          exercise_id: "exercise-2",
          order_index: 1,
          sets: [],
        },
        {
          id: "ex-3",
          session_id: "session-1",
          exercise_id: "exercise-3",
          order_index: 2,
          sets: [],
        },
        {
          id: "ex-4",
          session_id: "session-1",
          exercise_id: "exercise-4",
          order_index: 3,
          sets: [],
        },
        {
          id: "ex-5",
          session_id: "session-1",
          exercise_id: "exercise-5",
          order_index: 4,
          sets: [],
        },
        {
          id: "ex-6",
          session_id: "session-1",
          exercise_id: "exercise-6",
          order_index: 5,
          sets: [],
        },
      ],
    };

    vi.mocked(api.listSessions).mockImplementation((params) => {
      if (params?.status === "planned") {
        return Promise.resolve({
          data: [sessionWithManyExercises as SessionWithExercises],
          total: 1,
          limit: 50,
          offset: 0,
        });
      }
      return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0 });
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("+1 more")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
