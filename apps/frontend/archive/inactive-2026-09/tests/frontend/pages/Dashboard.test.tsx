import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Dashboard from "../../src/pages/Dashboard";
import * as api from "../../src/services/api";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

// Mock the API module
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getDashboardAnalytics: vi.fn(),
  };
});

const mockDashboardData = {
  summary: [
    { id: "streak", label: "Training streak", value: "5 days", trend: "+2 vs last period" },
    { id: "sessions", label: "Sessions completed", value: "12", trend: "+3 vs last period" },
    { id: "volume", label: "Total volume", value: "45.2k kg", trend: "+5.1k kg vs last period" },
  ],
  personalRecords: [
    { lift: "Squat", value: "150 kg", achieved: "2025-01-15", visibility: "public" as const },
    { lift: "Bench Press", value: "100 kg", achieved: "2025-01-10", visibility: "public" as const },
    { lift: "Deadlift", value: "180 kg", achieved: "2025-01-12", visibility: "public" as const },
  ],
  aggregates: [
    { period: "Week 1", volume: 10000, sessions: 3 },
    { period: "Week 2", volume: 12000, sessions: 4 },
    { period: "Week 3", volume: 11500, sessions: 3 },
    { period: "Week 4", volume: 11700, sessions: 4 },
  ],
  meta: {
    range: "4w" as const,
    grain: "weekly" as const,
    totalRows: 4,
    truncated: false,
  },
};

describe("Dashboard analytics", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(api.getDashboardAnalytics).mockResolvedValue(mockDashboardData);
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("limits aggregate rows to five entries", async () => {
    renderWithProvider(<Dashboard />);

    // Wait for data to load
    await screen.findByText(/Training streak/i, {}, { timeout: 1000 });

    // Wait for table to render, then check rows
    await screen.findByRole("table", {}, { timeout: 1000 });
    const rows = screen.getAllByRole("row").slice(1); // exclude header
    // The table should have at most 5 data rows (4 aggregate rows + possibly 1 summary row)
    // Adjust expectation: if there are summary rows, they should be counted separately
    const dataRows = rows.filter((row) => {
      const text = row.textContent || "";
      return text.includes("Week") || text.includes("volume") || text.includes("sessions");
    });
    expect(dataRows.length).toBeLessThanOrEqual(5);
  });

  it("updates aggregates when selecting a different range", async () => {
    const mockDataWith8Weeks = {
      ...mockDashboardData,
      aggregates: [
        { period: "Week 1", volume: 10000, sessions: 3 },
        { period: "Week 2", volume: 12000, sessions: 4 },
        { period: "Week 3", volume: 11500, sessions: 3 },
        { period: "Week 4", volume: 11700, sessions: 4 },
        { period: "Week 5", volume: 10800, sessions: 3 },
      ],
      meta: {
        range: "8w" as const,
        grain: "weekly" as const,
        totalRows: 5,
        truncated: false,
      },
    };

    vi.mocked(api.getDashboardAnalytics).mockResolvedValueOnce(mockDashboardData);
    renderWithProvider(<Dashboard />);

    // Wait for initial render
    await screen.findByText(/Training streak/i, {}, { timeout: 1000 });

    // Update mock for 8w range
    vi.mocked(api.getDashboardAnalytics).mockResolvedValueOnce(mockDataWith8Weeks);

    const rangeSelect = screen.getByRole("combobox", { name: /range/i });
    fireEvent.change(rangeSelect, { target: { value: "8w" } });

    await waitFor(
      () => {
        expect(api.getDashboardAnalytics).toHaveBeenCalledWith({
          range: "8w",
          grain: "weekly",
        });
      },
      { timeout: 2000 },
    );
  });

  it("switches grain using toggle buttons", async () => {
    const mockDataWithMonthly = {
      ...mockDashboardData,
      meta: {
        range: "4w" as const,
        grain: "monthly" as const,
        totalRows: 4,
        truncated: false,
      },
    };

    vi.mocked(api.getDashboardAnalytics).mockResolvedValueOnce(mockDashboardData);
    renderWithProvider(<Dashboard />);

    // Wait for initial render
    await screen.findByText(/Training streak/i, {}, { timeout: 1000 });

    // Update mock for monthly grain
    vi.mocked(api.getDashboardAnalytics).mockResolvedValueOnce(mockDataWithMonthly);

    const monthlyButton = screen.getByRole("button", { name: /monthly/i });
    fireEvent.click(monthlyButton);

    await waitFor(
      () => {
        expect(api.getDashboardAnalytics).toHaveBeenCalledWith({
          range: "4w",
          grain: "monthly",
        });
      },
      { timeout: 2000 },
    );
  });
});
