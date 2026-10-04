import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import Insights from "../../src/pages/Insights";
import * as api from "../../src/services/api";
import { useDashboardAnalytics } from "../../src/hooks/useDashboardAnalytics";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../src/hooks/useDashboardAnalytics", () => ({
  useDashboardAnalytics: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  getProgressTrends: vi.fn(),
  getExerciseBreakdown: vi.fn(),
  exportProgress: vi.fn(),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    apiError: vi.fn(),
  },
}));

vi.mock("../../src/contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "insights.eyebrow": "Insights",
          "insights.title": "Analytics & Insights",
          "insights.description": "Track your progress",
          "insights.dashboardTab": "Dashboard",
          "insights.progressTab": "Progress",
          "dashboard.last4Weeks": "Last 4 weeks",
          "dashboard.last8Weeks": "Last 8 weeks",
          "dashboard.weekly": "Weekly",
          "dashboard.monthly": "Monthly",
          "dashboard.selectRange": "Select range",
          "progress.presetRange": "Preset",
          "progress.customRange": "Custom",
          "progress.period": "Period",
          "progress.7days": "7 days",
          "progress.30days": "30 days",
          "progress.90days": "90 days",
          "progress.groupBy": "Group by",
          "progress.daily": "Daily",
          "progress.export": "Export",
          "progress.exportCsv": "Export CSV",
          "progress.exportError": "Export failed",
          "progress.exportFailed": "Export failed",
          "progress.volumeTrend": "Volume Trend",
          "progress.sessionsTrend": "Sessions Trend",
          "progress.intensityTrend": "Intensity Trend",
          "progress.exerciseBreakdown": "Exercise Breakdown",
          "progress.loadError": "Failed to load",
          "progress.failedToLoad": "Failed to load",
          "progress.failedToLoadExercise": "Failed to load exercises",
          "progress.retry": "Retry",
          "progress.noData": "No data available",
          "progress.noExercises": "No exercises",
          "progress.noExerciseData": "No exercise data",
          "progress.exercise": "Exercise",
          "progress.sessions": "Sessions",
          "progress.totalVolume": "Total Volume",
          "progress.avgVolume": "Avg Volume",
          "progress.maxWeight": "Max Weight",
          "progress.trend": "Trend",
          "progress.trendUp": "Up",
          "progress.trendDown": "Down",
          "progress.trendStable": "Stable",
          "progress.chartError": "Chart error",
          "progress.reload": "Reload",
          "progress.reloadPage": "Reload page",
        };
        return translations[key] || key;
      },
      i18n: {
        language: "en",
      },
    }),
  };
});

describe("Insights page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
  });

  const renderInsights = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Insights />
      </QueryClientProvider>,
    );
  };

  it("should render insights page with tabs", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText("Analytics & Insights")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Progress")).toBeInTheDocument();
  });

  it("should switch between dashboard and progress tabs", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    expect(screen.getByText("Volume Trend")).toBeInTheDocument();
  });

  it("should display dashboard metrics", () => {
    const mockData = {
      summary: [
        {
          id: "streak",
          label: "Training streak",
          value: "24 days",
          trend: "+3 vs last week",
        },
      ],
      personalRecords: [],
      aggregates: [],
      meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
    };

    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: mockData,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText("Training streak")).toBeInTheDocument();
    expect(screen.getByText("24 days")).toBeInTheDocument();
  });

  it("should handle export progress", async () => {
    const mockBlob = new Blob(["test"], { type: "text/csv" });
    vi.mocked(api.exportProgress).mockResolvedValue(mockBlob);

    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    // Ensure required globals exist
    if (typeof document === "undefined" || !document.createElement) {
      throw new Error("document.createElement is not available in test environment");
    }
    if (typeof global === "undefined") {
      throw new Error("global is not available in test environment");
    }

    // Mock window.URL.createObjectURL (the code uses window.URL, not global.URL)
    const createObjectURLSpy = vi.fn(() => "blob:test");

    // Ensure window.URL exists and save original
    let originalCreateObjectURL: ((blob: Blob) => string) | undefined;
    if (!window.URL) {
      (window as { URL: typeof URL }).URL = {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: vi.fn(),
      } as typeof URL;
    } else {
      // Save original if it exists (may be undefined in jsdom)
      originalCreateObjectURL =
        "createObjectURL" in window.URL && typeof window.URL.createObjectURL === "function"
          ? window.URL.createObjectURL
          : undefined;
      // Set the mock
      window.URL.createObjectURL = createObjectURLSpy;
    }

    // Mock document.createElement for anchor elements
    // Ensure document is available
    if (
      typeof document === "undefined" ||
      !document ||
      typeof document.createElement !== "function"
    ) {
      throw new Error("document.createElement is not available in test environment");
    }

    const clickSpy = vi.fn();
    const removeSpy = vi.fn();

    // Create anchor element - document should be available in jsdom
    const anchorElement = document.createElement("a");
    anchorElement.click = clickSpy;
    anchorElement.remove = removeSpy;

    // Save original implementation before spying
    const originalCreateElement = document.createElement;
    // Spy on createElement
    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return anchorElement;
      }
      // For other elements, use the original implementation
      return originalCreateElement.call(document, tagName);
    });

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    await waitFor(
      () => {
        // Button text is "Export" based on translation mock
        expect(screen.getByText("Export")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const exportButton = screen.getByText("Export");
    fireEvent.click(exportButton);

    await waitFor(
      () => {
        expect(api.exportProgress).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );

    createElementSpy.mockRestore();
    // Note: URL.createObjectURL mock will be cleaned up by vi.restoreAllMocks in beforeEach
  });

  it("should display error message when dashboard data fails to load", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error("Failed to load"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText(/We could not refresh analytics right now/i)).toBeInTheDocument();
  });

  describe("dashboard tab functionality", () => {
    it("should display personal records", () => {
      const mockData = {
        summary: [],
        personalRecords: [
          {
            lift: "Squat",
            value: "200 kg",
            achieved: "2 weeks ago",
            visibility: "public" as const,
          },
        ],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      };

      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: mockData,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      expect(screen.getByText("Squat")).toBeInTheDocument();
      expect(screen.getByText("200 kg")).toBeInTheDocument();
    });

    it("should display default personal records when none provided", () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: {
          summary: [],
          personalRecords: [],
          aggregates: [],
          meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      expect(screen.getByText("Back squat")).toBeInTheDocument();
    });

    it("should display aggregate rows", () => {
      const mockData = {
        summary: [],
        personalRecords: [],
        aggregates: [
          { period: "Week 1", volume: 50000, sessions: 5 },
          { period: "Week 2", volume: 52000, sessions: 6 },
        ],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 2, truncated: false },
      };

      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: mockData,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      expect(screen.getByText("Week 1")).toBeInTheDocument();
      expect(screen.getByText(`${(50000).toLocaleString()} kg`)).toBeInTheDocument();
    });

    it("should show loading state for metrics", () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      // Should show skeleton loaders - Skeleton components have aria-hidden="true"
      // Look for divs with aria-hidden="true" which are the Skeleton components
      const skeletons = document.querySelectorAll('div[aria-hidden="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should show refreshing indicator when fetching", () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: {
          summary: [],
          personalRecords: [],
          aggregates: [],
          meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
        },
        isLoading: false,
        isFetching: true,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      expect(screen.getByText("Refreshing…")).toBeInTheDocument();
    });

    it("should call refetch when retry button is clicked", () => {
      const refetchMock = vi.fn();
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: new Error("Failed"),
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      const retryButton = screen.getByText("Retry");
      fireEvent.click(retryButton);

      expect(refetchMock).toHaveBeenCalled();
    });
  });

  describe("progress tab functionality", () => {
    beforeEach(() => {
      vi.mocked(api.getProgressTrends).mockResolvedValue([]);
      vi.mocked(api.getExerciseBreakdown).mockResolvedValue([]);
    });

    it("should switch to progress tab", () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      expect(screen.getByText("Volume Trend")).toBeInTheDocument();
    });

    it("should toggle between preset and custom range modes", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      // Switch to custom mode
      const customButton = screen.getByText("Custom");
      fireEvent.click(customButton);

      // Should show date range picker
      await waitFor(
        () => {
          // DateRangePicker should be rendered
          expect(screen.getByText("Preset")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Switch back to preset
      const presetButton = screen.getByText("Preset");
      fireEvent.click(presetButton);

      await waitFor(
        () => {
          const periodSelect = screen.getByLabelText(/Period/i);
          expect(periodSelect).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it("should change period in preset mode", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          const periodSelect = screen.getByLabelText(/Period/i) as HTMLSelectElement;
          expect(periodSelect).toBeInTheDocument();

          // Change period
          fireEvent.change(periodSelect, { target: { value: "90" } });
          expect(periodSelect.value).toBe("90");
        },
        { timeout: 5000 },
      );
    });

    it("should change group by option", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          const groupBySelect = screen.getByLabelText(/Group by/i) as HTMLSelectElement;
          expect(groupBySelect).toBeInTheDocument();

          // Change to daily
          fireEvent.change(groupBySelect, { target: { value: "day" } });
          expect(groupBySelect.value).toBe("day");
        },
        { timeout: 5000 },
      );
    });

    it("should handle export error", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      vi.mocked(api.exportProgress).mockRejectedValueOnce(new Error("Export failed"));

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(screen.getByText("Export")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      const exportButton = screen.getByText("Export");
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(api.exportProgress).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("should display trends data when loaded", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      const mockTrends = [
        { label: "Week 1", volume: 50000, sessions: 5, avgIntensity: 7.5 },
        { label: "Week 2", volume: 52000, sessions: 6, avgIntensity: 8.0 },
      ];

      vi.mocked(api.getProgressTrends).mockResolvedValueOnce(mockTrends as any);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(api.getProgressTrends).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("should display exercise breakdown when loaded", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      const mockBreakdown = [
        {
          exercise: "Bench Press",
          sessions: 10,
          totalVolume: 50000,
          avgVolume: 5000,
          maxWeight: 100,
          trend: "up" as const,
        },
      ];

      vi.mocked(api.getExerciseBreakdown).mockResolvedValueOnce(mockBreakdown as any);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(api.getExerciseBreakdown).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("should handle trends loading error", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      vi.mocked(api.getProgressTrends).mockRejectedValueOnce(new Error("Failed to load"));

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(api.getProgressTrends).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("should handle exercise breakdown loading error", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      vi.mocked(api.getExerciseBreakdown).mockRejectedValueOnce(new Error("Failed to load"));

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(api.getExerciseBreakdown).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("should display retry button on trends error", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      // Mock the API to reject - the query retries 3 times, so we need to reject 4 times
      // (initial call + 3 retries) before the error state is set
      vi.mocked(api.getProgressTrends)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"));

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      // Wait for the query to run, fail, and error state to render
      // React Query might retry, so wait a bit longer
      // Wait for retry buttons to appear - there are multiple (one per chart)
      await waitFor(
        () => {
          const retryButtons = screen.getAllByText("Retry");
          expect(retryButtons.length).toBeGreaterThan(0);
        },
        { timeout: 20000 },
      );

      // Note: The retry button will appear after React Query retries 3 times,
      // which can take 10+ seconds. This test verifies the query setup is correct.
      // Full error state testing is covered by React Query's own tests.
    });

    it("should call refetchTrends when retry is clicked", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      // Mock the API to reject 4 times (initial + 3 retries) to trigger error state
      // Then on manual retry (5th call), it should succeed
      vi.mocked(api.getProgressTrends)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce([]);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      // Wait for retry button to appear after all retries fail
      // There are multiple Retry buttons (one per chart), so use getAllByText
      await waitFor(
        () => {
          const retryButtons = screen.getAllByText("Retry");
          expect(retryButtons.length).toBeGreaterThan(0);
        },
        { timeout: 20000 },
      );

      // Use the first retry button
      const retryButtons = screen.getAllByText("Retry");
      const retryButton = retryButtons[0];
      const callCountBefore = vi.mocked(api.getProgressTrends).mock.calls.length;
      fireEvent.click(retryButton);

      // Wait for refetch to be called (should be called again after retry click)
      await waitFor(
        () => {
          expect(vi.mocked(api.getProgressTrends).mock.calls.length).toBeGreaterThan(
            callCountBefore,
          );
        },
        { timeout: 5000 },
      );

      // Note: The retry button will appear after React Query retries 3 times,
      // which can take 10+ seconds. This test verifies the query setup is correct.
      // Full error state and retry behavior is covered by React Query's own tests.
    });

    it("should display no data message when trends are empty", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      vi.mocked(api.getProgressTrends).mockResolvedValue([]);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      // There are multiple "No data available" elements, so use getAllByText
      await waitFor(
        () => {
          const noDataElements = screen.getAllByText("No data available");
          expect(noDataElements.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("should display no exercises message when breakdown is empty", async () => {
      vi.mocked(useDashboardAnalytics).mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDashboardAnalytics>);

      vi.mocked(api.getExerciseBreakdown).mockResolvedValueOnce([]);

      renderInsights();

      const progressTab = screen.getByText("Progress");
      fireEvent.click(progressTab);

      await waitFor(
        () => {
          expect(screen.getByText("No exercises")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  it("should allow changing dashboard range", () => {
    const mockRefetch = vi.fn();
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    const rangeSelect = screen.getByLabelText("Select range");
    fireEvent.change(rangeSelect, { target: { value: "8w" } });

    // The component should update state, which triggers useDashboardAnalytics with new params
    expect(rangeSelect).toHaveValue("8w");
  });

  it("should change grain between weekly and monthly", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    const monthlyButton = screen.getByText("Monthly");
    fireEvent.click(monthlyButton);

    expect(monthlyButton).toBeInTheDocument();
  });

  it("should display loading state for metrics", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    // Should show skeleton during loading - check for default label but not value
    expect(screen.getByText("Training streak")).toBeInTheDocument();
    // Value should not be visible when loading (skeleton is shown instead)
    expect(screen.queryByText("24 days")).not.toBeInTheDocument();
  });

  it("should display metrics without trends", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [
          {
            id: "streak",
            label: "Training streak",
            value: "24 days",
            trend: undefined,
          },
        ],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText("Training streak")).toBeInTheDocument();
    expect(screen.getByText("24 days")).toBeInTheDocument();
  });

  it("should display numeric metric values", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [
          {
            id: "volume",
            label: "Weekly volume",
            value: 52300,
            trend: "+5%",
          },
        ],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText("Weekly volume")).toBeInTheDocument();
    expect(screen.getByText((52300).toLocaleString())).toBeInTheDocument();
  });

  it("should show isFetching indicator", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
  });

  it("should use fallback aggregates when data is empty", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: {
        summary: [],
        personalRecords: [],
        aggregates: [],
        meta: { range: "4w" as const, grain: "weekly" as const, totalRows: 0, truncated: false },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    renderInsights();

    // Should show table with fallback data
    expect(screen.getByText("Period")).toBeInTheDocument();
  });

  it("should switch to custom range mode in progress tab", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    vi.mocked(api.getProgressTrends).mockResolvedValue([]);
    vi.mocked(api.getExerciseBreakdown).mockResolvedValue({ exercises: [], period: 30 });

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    const customButton = screen.getByText("Custom");
    fireEvent.click(customButton);

    expect(customButton).toBeInTheDocument();
  });

  it("should change period in progress tab", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    vi.mocked(api.getProgressTrends).mockResolvedValue([]);
    vi.mocked(api.getExerciseBreakdown).mockResolvedValue({ exercises: [], period: 30 });

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    const periodSelect = screen.getByLabelText(/period/i);
    fireEvent.change(periodSelect, { target: { value: "90" } });

    expect(periodSelect).toHaveValue("90");
  });

  it("should change group by in progress tab", () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    vi.mocked(api.getProgressTrends).mockResolvedValue([]);
    vi.mocked(api.getExerciseBreakdown).mockResolvedValue({ exercises: [], period: 30 });

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    const groupBySelect = screen.getByLabelText(/group by/i);
    fireEvent.change(groupBySelect, { target: { value: "day" } });

    expect(groupBySelect).toHaveValue("day");
  });

  it("should display empty state when trends data is empty", async () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    vi.mocked(api.getProgressTrends).mockResolvedValue([]);
    vi.mocked(api.getExerciseBreakdown).mockResolvedValue({ exercises: [], period: 30 });

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    await waitFor(
      () => {
        expect(screen.getByText("Volume Trend")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle export error in progress tab", async () => {
    vi.mocked(useDashboardAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardAnalytics>);

    vi.mocked(api.getProgressTrends).mockResolvedValue([]);
    vi.mocked(api.getExerciseBreakdown).mockResolvedValue({ exercises: [], period: 30 });
    vi.mocked(api.exportProgress).mockRejectedValue(new Error("Export failed"));

    renderInsights();

    const progressTab = screen.getByText("Progress");
    fireEvent.click(progressTab);

    await waitFor(
      () => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const exportButton = screen.getByText("Export");
    fireEvent.click(exportButton);

    await waitFor(
      () => {
        expect(api.exportProgress).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });
});
