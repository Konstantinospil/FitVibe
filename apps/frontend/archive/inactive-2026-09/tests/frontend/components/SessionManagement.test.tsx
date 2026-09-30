/**
 * SessionManagement Component Tests
 * Tests user-visible behavior and functionality, not implementation details
 */

import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionManagement } from "../../src/components/SessionManagement";
import * as api from "../../src/services/api";
import type { SessionInfo } from "../../src/services/api";

// Mock dependencies
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock("../../src/contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

vi.mock("../../src/services/api", () => ({
  listAuthSessions: vi.fn(),
  revokeAuthSessions: vi.fn(),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    apiError: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth.sessions.title": "Active Sessions",
        "auth.sessions.description": "Manage your active authentication sessions",
        "auth.sessions.loading": "Loading sessions...",
        "auth.sessions.loadError": "Failed to load sessions",
        "auth.sessions.noSessions": "No active sessions",
        "auth.sessions.current": "Current",
        "auth.sessions.otherSessions": "Other Sessions",
        "auth.sessions.revokeOthers": "Revoke All Others",
        "auth.sessions.revokeAll": "Revoke All Sessions",
        "auth.sessions.revoked": "Session revoked successfully",
        "auth.sessions.revokeError": "Failed to revoke session",
        "auth.sessions.allRevoked": "All sessions revoked successfully",
        "auth.sessions.revokeAllError": "Failed to revoke all sessions",
        "auth.sessions.othersRevoked": "Other sessions revoked successfully",
        "auth.sessions.revokeOthersError": "Failed to revoke other sessions",
        "auth.sessions.confirmRevokeAll": "Revoke All Sessions?",
        "auth.sessions.confirmRevokeAllMessage":
          "This will log you out from all devices. You will need to log in again. Are you sure?",
        "auth.sessions.confirmRevokeOthers": "Revoke Other Sessions?",
        "auth.sessions.confirmRevokeOthersMessage":
          "This will log you out from all other devices except this one. Are you sure?",
        "auth.sessions.ip": "IP",
        "auth.sessions.created": "Created",
        "auth.sessions.expires": "Expires",
        "auth.sessions.revoke": "Revoke session",
        "auth.sessions.unknownDevice": "Unknown device",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SessionManagement", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Loading state", () => {
    it("should show loading message while fetching sessions", () => {
      vi.mocked(api.listAuthSessions).mockImplementation(() => new Promise(() => {}));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      expect(screen.getByText("Active Sessions")).toBeInTheDocument();
      expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("should show message when user has no active sessions", async () => {
      const mockListAuthSessions = vi.mocked(api.listAuthSessions);
      mockListAuthSessions.mockResolvedValue({ sessions: [] });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      // Verify API is called
      await waitFor(
        () => {
          expect(mockListAuthSessions).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify empty state message appears
      expect(screen.getByText(/no active sessions/i)).toBeInTheDocument();
    });
  });

  describe("Displaying sessions", () => {
    const mockSessions: SessionInfo[] = [
      {
        id: "current-session",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        ip: "192.168.1.100",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
        isCurrent: true,
        revokedAt: null,
      },
      {
        id: "other-session-1",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1",
        ip: "192.168.1.101",
        createdAt: "2024-01-02T00:00:00Z",
        expiresAt: "2024-01-09T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
      {
        id: "other-session-2",
        userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605.1.15 Safari/604.1",
        ip: "192.168.1.102",
        createdAt: "2024-01-03T00:00:00Z",
        expiresAt: "2024-01-10T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
    ];

    it("should display current session with 'Current' badge", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(screen.getByText(/Chrome/i)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("should display other sessions in separate section", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(screen.getByText("Other Sessions")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
      // Check for Safari - there should be at least one
      const safariElements = screen.getAllByText(/Safari/i);
      expect(safariElements.length).toBeGreaterThan(0);
    });

    it("should display session metadata (IP, created date, expires date)", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(screen.getByText(/IP: 192\.168\.1\.100/i)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
      await waitFor(
        () => {
          expect(screen.getAllByText(/Created:/i).length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
      expect(screen.getAllByText(/Expires:/i).length).toBeGreaterThan(0);
    });

    it("should not display revoked sessions", async () => {
      const sessionsWithRevoked: SessionInfo[] = [
        ...mockSessions,
        {
          id: "revoked-session",
          userAgent: "Mozilla/5.0",
          ip: "192.168.1.103",
          createdAt: "2024-01-04T00:00:00Z",
          expiresAt: "2024-01-11T00:00:00Z",
          isCurrent: false,
          revokedAt: "2024-01-05T00:00:00Z",
        },
      ];

      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: sessionsWithRevoked });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Should only show 3 active sessions (1 current + 2 others), not the revoked one
      await waitFor(
        () => {
          const revokeButtons = screen.getAllByLabelText(/revoke session/i);
          expect(revokeButtons.length).toBe(2); // Only other sessions have revoke buttons
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Revoking individual sessions", () => {
    const mockSessions: SessionInfo[] = [
      {
        id: "current-session",
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        ip: "192.168.1.100",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
        isCurrent: true,
        revokedAt: null,
      },
      {
        id: "other-session",
        userAgent: "Mozilla/5.0 Safari/604.1",
        ip: "192.168.1.101",
        createdAt: "2024-01-02T00:00:00Z",
        expiresAt: "2024-01-09T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
    ];

    it("should revoke a session when user clicks revoke button", async () => {
      vi.mocked(api.listAuthSessions)
        .mockResolvedValueOnce({ sessions: mockSessions })
        .mockResolvedValueOnce({ sessions: [mockSessions[0]] });
      vi.mocked(api.revokeAuthSessions).mockResolvedValue(undefined);

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeButtons = await waitFor(
        () => {
          const buttons = screen.getAllByLabelText(/revoke session/i);
          expect(buttons.length).toBe(1);
          return buttons;
        },
        { timeout: 3000 },
      );

      fireEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(api.revokeAuthSessions).toHaveBeenCalledWith({ sessionId: "other-session" });
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("Session revoked successfully");
      });
    });

    it("should reload sessions list after revoking", async () => {
      vi.mocked(api.listAuthSessions)
        .mockResolvedValueOnce({ sessions: mockSessions })
        .mockResolvedValueOnce({ sessions: [mockSessions[0]] });
      vi.mocked(api.revokeAuthSessions).mockResolvedValue(undefined);

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeButtons = await waitFor(
        () => {
          const buttons = screen.getAllByLabelText(/revoke session/i);
          expect(buttons.length).toBeGreaterThan(0);
          return buttons;
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(api.listAuthSessions).toHaveBeenCalledTimes(2);
      });
    });

    it("should show error message when revoke fails", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockRejectedValue(new Error("Network error"));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeButtons = await waitFor(
        () => {
          const buttons = screen.getAllByLabelText(/revoke session/i);
          expect(buttons.length).toBeGreaterThan(0);
          return buttons;
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to revoke session");
      });
    });

    it("should disable revoke buttons while revoking is in progress", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockImplementation(() => new Promise(() => {}));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeButtons = await waitFor(
        () => {
          const buttons = screen.getAllByLabelText(/revoke session/i);
          expect(buttons.length).toBeGreaterThan(0);
          return buttons;
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeButtons[0]);

      await waitFor(() => {
        const buttons = screen.getAllByLabelText(/revoke session/i);
        buttons.forEach((button) => {
          expect(button).toBeDisabled();
        });
      });
    });
  });

  describe("Revoking all other sessions", () => {
    const mockSessions: SessionInfo[] = [
      {
        id: "current-session",
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        ip: "192.168.1.100",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
        isCurrent: true,
        revokedAt: null,
      },
      {
        id: "other-session-1",
        userAgent: "Mozilla/5.0 Safari/604.1",
        ip: "192.168.1.101",
        createdAt: "2024-01-02T00:00:00Z",
        expiresAt: "2024-01-09T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
      {
        id: "other-session-2",
        userAgent: "Mozilla/5.0 Firefox/121.0",
        ip: "192.168.1.102",
        createdAt: "2024-01-03T00:00:00Z",
        expiresAt: "2024-01-10T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
    ];

    it("should show confirmation dialog when user clicks 'Revoke All Others'", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeOthersButton = await waitFor(
        () => {
          return screen.getByText(/revoke all others/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeOthersButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke Other Sessions?")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/This will log you out from all other devices except this one/i),
      ).toBeInTheDocument();
    });

    it("should revoke all other sessions when user confirms", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockResolvedValue(undefined);

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeOthersButton = await waitFor(
        () => {
          return screen.getByText(/revoke all others/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeOthersButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke Other Sessions?")).toBeInTheDocument();
      });

      const dialog = await waitFor(() => {
        const title = screen.getByText("Revoke Other Sessions?");
        const dialogElement = title.closest("div[style*='position: fixed']");
        if (!dialogElement) {
          throw new Error("Dialog not found");
        }
        return dialogElement;
      });

      const confirmButton = await waitFor(() => {
        return within(dialog as HTMLElement).getByRole("button", {
          name: /revoke all others/i,
        });
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.revokeAuthSessions).toHaveBeenCalledWith({ revokeOthers: true });
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("Other sessions revoked successfully");
      });
    });

    it("should cancel revoke when user clicks cancel in confirmation dialog", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeOthersButton = await waitFor(
        () => {
          return screen.getByText(/revoke all others/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeOthersButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke Other Sessions?")).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Revoke Other Sessions?")).not.toBeInTheDocument();
      });

      expect(api.revokeAuthSessions).not.toHaveBeenCalled();
    });

    it("should show error message when revoke others fails", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockRejectedValue(new Error("Network error"));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeOthersButton = await waitFor(
        () => {
          return screen.getByText(/revoke all others/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeOthersButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke Other Sessions?")).toBeInTheDocument();
      });

      const dialog = await waitFor(() => {
        const title = screen.getByText("Revoke Other Sessions?");
        const dialogElement = title.closest("div[style*='position: fixed']");
        if (!dialogElement) {
          throw new Error("Dialog not found");
        }
        return dialogElement;
      });

      const confirmButton = await waitFor(() => {
        return within(dialog as HTMLElement).getByRole("button", {
          name: /revoke all others/i,
        });
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to revoke other sessions");
      });
    });
  });

  describe("Revoking all sessions", () => {
    const mockSessions: SessionInfo[] = [
      {
        id: "current-session",
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        ip: "192.168.1.100",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
        isCurrent: true,
        revokedAt: null,
      },
      {
        id: "other-session",
        userAgent: "Mozilla/5.0 Safari/604.1",
        ip: "192.168.1.101",
        createdAt: "2024-01-02T00:00:00Z",
        expiresAt: "2024-01-09T00:00:00Z",
        isCurrent: false,
        revokedAt: null,
      },
    ];

    it("should show confirmation dialog when user clicks 'Revoke All Sessions'", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeAllButton = await waitFor(
        () => {
          return screen.getByText(/revoke all sessions/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeAllButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke All Sessions?")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/This will log you out from all devices. You will need to log in again/i),
      ).toBeInTheDocument();
    });

    it("should revoke all sessions when user confirms", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockResolvedValue(undefined);

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeAllButton = await waitFor(
        () => {
          return screen.getByText(/revoke all sessions/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeAllButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke All Sessions?")).toBeInTheDocument();
      });

      const dialog = await waitFor(() => {
        const title = screen.getByText("Revoke All Sessions?");
        const dialogElement = title.closest("div[style*='position: fixed']");
        if (!dialogElement) {
          throw new Error("Dialog not found");
        }
        return dialogElement;
      });

      const confirmButton = await waitFor(() => {
        return within(dialog as HTMLElement).getByRole("button", {
          name: /revoke all sessions/i,
        });
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.revokeAuthSessions).toHaveBeenCalledWith({ revokeAll: true });
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("All sessions revoked successfully");
      });
    });

    it("should cancel revoke when user clicks cancel in confirmation dialog", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeAllButton = await waitFor(
        () => {
          return screen.getByText(/revoke all sessions/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeAllButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke All Sessions?")).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Revoke All Sessions?")).not.toBeInTheDocument();
      });

      expect(api.revokeAuthSessions).not.toHaveBeenCalled();
    });

    it("should show error message when revoke all fails", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions: mockSessions });
      vi.mocked(api.revokeAuthSessions).mockRejectedValue(new Error("Network error"));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const revokeAllButton = await waitFor(
        () => {
          return screen.getByText(/revoke all sessions/i);
        },
        { timeout: 3000 },
      );
      fireEvent.click(revokeAllButton);

      await waitFor(() => {
        expect(screen.getByText("Revoke All Sessions?")).toBeInTheDocument();
      });

      const dialog = await waitFor(() => {
        const title = screen.getByText("Revoke All Sessions?");
        const dialogElement = title.closest("div[style*='position: fixed']");
        if (!dialogElement) {
          throw new Error("Dialog not found");
        }
        return dialogElement;
      });

      const confirmButton = await waitFor(() => {
        return within(dialog as HTMLElement).getByRole("button", {
          name: /revoke all sessions/i,
        });
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to revoke all sessions");
      });
    });
  });

  describe("Error handling", () => {
    it("should show error message when loading sessions fails", async () => {
      vi.mocked(api.listAuthSessions).mockRejectedValue(new Error("Network error"));

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to load sessions");
      });
    });
  });

  describe("Device information display", () => {
    it("should display 'Unknown device' when user agent is missing", async () => {
      const sessions: SessionInfo[] = [
        {
          id: "session-1",
          userAgent: null,
          ip: "192.168.1.1",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
          isCurrent: true,
          revokedAt: null,
        },
      ];

      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(screen.getByText(/unknown device/i)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("should display browser name from user agent", async () => {
      const sessions: SessionInfo[] = [
        {
          id: "session-1",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
          ip: "192.168.1.1",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
          isCurrent: true,
          revokedAt: null,
        },
        {
          id: "session-2",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1",
          ip: "192.168.1.2",
          createdAt: "2024-01-02T00:00:00Z",
          expiresAt: "2024-01-09T00:00:00Z",
          isCurrent: false,
          revokedAt: null,
        },
        {
          id: "session-3",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0",
          ip: null,
          createdAt: "not-a-date",
          expiresAt: "also-bad",
          isCurrent: false,
          revokedAt: null,
        },
        {
          id: "session-4",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64) OPR/80.0.0.0",
          ip: "10.0.0.4",
          createdAt: "2024-01-04T00:00:00Z",
          expiresAt: "2024-01-11T00:00:00Z",
          isCurrent: false,
          revokedAt: null,
        },
        {
          id: "session-5",
          userAgent: "FitVibeCustomAgent/1.0 extra-long-user-agent-value-for-fallback",
          ip: "10.0.0.5",
          createdAt: "2024-01-05T00:00:00Z",
          expiresAt: "2024-01-12T00:00:00Z",
          isCurrent: false,
          revokedAt: null,
        },
        {
          id: "session-6",
          userAgent:
            "Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 Mobile Safari/537.36",
          ip: "10.0.0.6",
          createdAt: "2024-01-06T00:00:00Z",
          expiresAt: "2024-01-13T00:00:00Z",
          isCurrent: false,
          revokedAt: null,
        },
      ];

      vi.mocked(api.listAuthSessions).mockResolvedValue({ sessions });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByText("Loading sessions...")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(screen.getByText("Chrome")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
      await waitFor(
        () => {
          expect(screen.getAllByText("Safari").length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
      expect(screen.getByText("Edge")).toBeInTheDocument();
      expect(screen.getByText("Opera")).toBeInTheDocument();
      expect(screen.getByText(/FitVibeCustomAgent/)).toBeInTheDocument();
    });

    it("labels android, tablet, and opera sessions without a current session", async () => {
      vi.mocked(api.listAuthSessions).mockResolvedValue({
        sessions: [
          {
            id: "android",
            userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36",
            ip: null,
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-08T00:00:00Z",
            isCurrent: false,
            revokedAt: null,
          },
          {
            id: "tablet",
            userAgent: "Mozilla/5.0 (Linux; Tablet) AppleWebKit/537.36 Firefox/120.0",
            ip: "10.0.0.8",
            createdAt: "2024-01-02T00:00:00Z",
            expiresAt: "2024-01-09T00:00:00Z",
            isCurrent: false,
            revokedAt: null,
          },
          {
            id: "opera",
            userAgent: "Opera/9.80 (Windows NT 6.1) Presto/2.12.388",
            ip: "10.0.0.9",
            createdAt: "2024-01-03T00:00:00Z",
            expiresAt: "2024-01-10T00:00:00Z",
            isCurrent: false,
            revokedAt: null,
          },
        ],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <SessionManagement />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Firefox")).toBeInTheDocument();
      });
      expect(screen.getByText("Opera")).toBeInTheDocument();
      expect(screen.queryByText("Current")).not.toBeInTheDocument();
    });
  });
});
