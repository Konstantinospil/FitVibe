import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SystemControls from "../../../../apps/frontend/src/pages/admin/SystemControls";
import * as api from "../../../../apps/frontend/src/services/api";
import * as adminApi from "../../../../apps/frontend/src/services/adminApi";
import { useToast } from "../../../../apps/frontend/src/contexts/ToastContext";

vi.mock("../../../../apps/frontend/src/services/api");
vi.mock("../../../../apps/frontend/src/services/adminApi");
vi.mock("../../../../apps/frontend/src/contexts/ToastContext");
vi.mock("../../../../apps/frontend/src/utils/logger", () => ({
  logger: {
    apiError: vi.fn(),
  },
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

describe("SystemControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue(mockToast);
    // Default mock for getRecentActivity
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([]);
  });

  const mockReadOnlyStatus: api.SystemReadOnlyStatus = {
    readOnlyMode: false,
    message: null,
    enabledAt: null,
    enabledBy: null,
    reason: null,
    estimatedDuration: null,
  };

  const mockHealthStatus: api.HealthStatusResponse = {
    status: "ok",
    uptime: 86400,
    version: "1.0.0",
    timestamp: "2025-01-01T00:00:00Z",
  };

  it("should render system controls page", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("System Health")).toBeInTheDocument();
        expect(screen.getByText("Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show loading state", () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    vi.mocked(api.getHealthStatus).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading system status...")).toBeInTheDocument();
  });

  it("should display system health status", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Healthy")).toBeInTheDocument();
        expect(screen.getByText("1d 0h")).toBeInTheDocument();
        expect(screen.getByText("Normal")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should display degraded health status", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue({
      ...mockHealthStatus,
      status: "degraded",
    });

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Degraded")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format uptime correctly", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue({
      ...mockHealthStatus,
      uptime: 3600, // 1 hour
    });

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("1h 0m")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show enable read-only mode button when not in read-only mode", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Enable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show enable form when enable button is clicked", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Enable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const enableButton = screen.getByText("Enable Read-Only Mode");
    fireEvent.click(enableButton);

    await waitFor(
      () => {
        expect(screen.getByText("Warning")).toBeInTheDocument();
        expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();
        expect(screen.getByLabelText("Estimated Duration (optional)")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should enable read-only mode when confirmed", async () => {
    vi.mocked(api.getSystemReadOnlyStatus)
      .mockResolvedValueOnce(mockReadOnlyStatus)
      .mockResolvedValueOnce({
        ...mockReadOnlyStatus,
        readOnlyMode: true,
        message: "Maintenance mode",
      });
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(api.enableReadOnlyMode).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Enable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const enableButton = screen.getByText("Enable Read-Only Mode");
    fireEvent.click(enableButton);

    await waitFor(
      () => {
        expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const reasonInput = screen.getByLabelText("Reason (optional)");
    fireEvent.change(reasonInput, { target: { value: "Emergency maintenance" } });

    const confirmButton = screen.getByText("Confirm Enable");
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(api.enableReadOnlyMode).toHaveBeenCalledWith({
          reason: "Emergency maintenance",
          estimatedDuration: undefined,
        });
        expect(mockToast.success).toHaveBeenCalledWith("Read-only mode enabled successfully");
      },
      { timeout: 5000 },
    );
  });

  it("should show error when enabling read-only mode fails", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(api.enableReadOnlyMode).mockRejectedValue(new Error("Failed to enable"));

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Enable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const enableButton = screen.getByText("Enable Read-Only Mode");
    fireEvent.click(enableButton);

    await waitFor(
      () => {
        expect(screen.getByText("Confirm Enable")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const confirmButton = screen.getByText("Confirm Enable");
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(
          screen.getByText("Failed to enable read-only mode. Please try again."),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show disable button when in read-only mode", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue({
      ...mockReadOnlyStatus,
      readOnlyMode: true,
      message: "Maintenance mode",
    });
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Read-Only Mode Active")).toBeInTheDocument();
        expect(screen.getByText("Disable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should disable read-only mode when confirmed", async () => {
    vi.mocked(api.getSystemReadOnlyStatus)
      .mockResolvedValueOnce({
        ...mockReadOnlyStatus,
        readOnlyMode: true,
        message: "Maintenance mode",
      })
      .mockResolvedValueOnce(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(api.disableReadOnlyMode).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const buttons = screen.getAllByText("Disable Read-Only Mode");
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const disableButtons = screen.getAllByText("Disable Read-Only Mode");
    // Click the button (first one should be the actual button)
    fireEvent.click(disableButtons[0]);

    await waitFor(
      () => {
        // Look for the dialog title specifically
        expect(screen.getByText("Disable Read-Only Mode", { selector: "h3" })).toBeInTheDocument();
        expect(
          screen.getByText(
            "Are you sure you want to disable read-only mode and restore normal operations?",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const confirmButton = screen.getByText("Yes, Disable");
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(api.disableReadOnlyMode).toHaveBeenCalledWith({
          notes: undefined,
        });
        expect(mockToast.success).toHaveBeenCalledWith("Read-only mode disabled successfully");
      },
      { timeout: 5000 },
    );
  });

  it("should set up polling interval on mount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    const { unmount } = render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    // Wait for initial load
    await waitFor(
      () => {
        expect(api.getSystemReadOnlyStatus).toHaveBeenCalledTimes(1);
        expect(api.getHealthStatus).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );

    // Clear call history to verify polling
    vi.clearAllMocks();
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    // Advance time by 30 seconds - but limit to avoid infinite loops
    vi.advanceTimersByTime(30000);

    // Unmount immediately to prevent infinite polling
    unmount();
    vi.useRealTimers();

    // Just verify the component rendered and set up the interval
    // Full polling behavior is better tested in integration tests
    expect(api.getSystemReadOnlyStatus).toHaveBeenCalled();
  });

  it("should cancel enable read-only mode", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Enable Read-Only Mode")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const enableButton = screen.getByText("Enable Read-Only Mode");
    fireEvent.click(enableButton);

    await waitFor(
      () => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    await waitFor(
      () => {
        expect(screen.queryByText("Warning")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(api.enableReadOnlyMode).not.toHaveBeenCalled();
  });

  it("should format uptime with days and hours", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue({
      ...mockHealthStatus,
      uptime: 90000, // 1 day 1 hour
    });

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("1d 1h")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format uptime with only minutes", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue({
      ...mockHealthStatus,
      uptime: 300, // 5 minutes
    });

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("5m")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format activity time as just now", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "test.action",
        entityType: "test",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Just now")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format activity time as minutes ago", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "test.action",
        entityType: "test",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: thirtyMinutesAgo,
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("30m ago")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format activity time as hours ago", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "test.action",
        entityType: "test",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: twoHoursAgo,
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("2h ago")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format activity time as days ago", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "test.action",
        entityType: "test",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: threeDaysAgo,
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("3d ago")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format activity time as date for older entries", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "test.action",
        entityType: "test",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: tenDaysAgo,
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        // Should show date format
        expect(
          screen.getByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle disable read-only mode with notes", async () => {
    vi.mocked(api.getSystemReadOnlyStatus)
      .mockResolvedValueOnce({
        ...mockReadOnlyStatus,
        readOnlyMode: true,
        message: "Maintenance mode",
      })
      .mockResolvedValueOnce(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(api.disableReadOnlyMode).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const buttons = screen.getAllByText("Disable Read-Only Mode");
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const disableButtons = screen.getAllByText("Disable Read-Only Mode");
    fireEvent.click(disableButtons[0]);

    await waitFor(
      () => {
        expect(screen.getByText("Disable Read-Only Mode", { selector: "h3" })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const notesInput = screen.getByLabelText("Notes (optional)");
    fireEvent.change(notesInput, { target: { value: "Maintenance complete" } });

    const confirmButton = screen.getByText("Yes, Disable");
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(api.disableReadOnlyMode).toHaveBeenCalledWith({
          notes: "Maintenance complete",
        });
      },
      { timeout: 5000 },
    );
  });

  it("should cancel disable confirmation", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue({
      ...mockReadOnlyStatus,
      readOnlyMode: true,
      message: "Maintenance mode",
    });
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const buttons = screen.getAllByText("Disable Read-Only Mode");
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const disableButtons = screen.getAllByText("Disable Read-Only Mode");
    fireEvent.click(disableButtons[0]);

    await waitFor(
      () => {
        expect(screen.getByText("Disable Read-Only Mode", { selector: "h3" })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    await waitFor(
      () => {
        expect(
          screen.queryByText("Disable Read-Only Mode", { selector: "h3" }),
        ).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(api.disableReadOnlyMode).not.toHaveBeenCalled();
  });

  it("should handle error loading system status", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockRejectedValue(new Error("Failed to load"));
    vi.mocked(api.getHealthStatus).mockRejectedValue(new Error("Failed to load"));

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        // Should still render, just without data
        expect(screen.getByText("System Health")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle error loading recent activity", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(adminApi.getRecentActivity).mockRejectedValue(new Error("Failed to load"));

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        // Should still render
        expect(screen.getByText("System Health")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should format action names correctly", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([
      {
        id: "1",
        actorUserId: "user1",
        actorUsername: "testuser",
        action: "auth.login",
        entityType: "user",
        entityId: "123",
        outcome: "success",
        requestId: null,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Login")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should display empty activity list", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue(mockReadOnlyStatus);
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(adminApi.getRecentActivity).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("System Health")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show error when disabling read-only mode fails", async () => {
    vi.mocked(api.getSystemReadOnlyStatus).mockResolvedValue({
      ...mockReadOnlyStatus,
      readOnlyMode: true,
      message: "Maintenance mode",
    });
    vi.mocked(api.getHealthStatus).mockResolvedValue(mockHealthStatus);
    vi.mocked(api.disableReadOnlyMode).mockRejectedValue(new Error("Failed to disable"));

    render(
      <MemoryRouter>
        <SystemControls />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const buttons = screen.getAllByText("Disable Read-Only Mode");
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const disableButtons = screen.getAllByText("Disable Read-Only Mode");
    fireEvent.click(disableButtons[0]);

    await waitFor(
      () => {
        expect(screen.getByText("Yes, Disable")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const confirmButton = screen.getByText("Yes, Disable");
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(
          screen.getByText("Failed to disable read-only mode. Please try again."),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
