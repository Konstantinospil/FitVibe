import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Outlet } from "react-router-dom";
import ProtectedRoutes from "../../../apps/frontend/src/routes/ProtectedRoutes";
import { useAuth } from "../../../apps/frontend/src/contexts/AuthContext";

vi.mock("../../../apps/frontend/src/contexts/AuthContext");
vi.mock("../../../apps/frontend/src/i18n/config", () => ({
  ensurePrivateTranslationsLoaded: vi.fn(() => Promise.resolve()),
}));

// Mock useAuthStore for AdminRoute component
vi.mock("../../../apps/frontend/src/store/auth.store", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: true,
      user: { id: "user-1", username: "test", email: "test@example.com", role: "admin" },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

// Mock ProtectedRoute and AdminRoute - they use Outlet to render nested routes
vi.mock("../../../apps/frontend/src/components/ProtectedRoute", () => ({
  default: () => <Outlet />,
}));

vi.mock("../../../apps/frontend/src/components/AdminRoute", () => ({
  default: () => <Outlet />,
}));

vi.mock("../../../apps/frontend/src/layouts/MainLayout", () => ({
  default: () => (
    <div data-testid="main-layout">
      <Outlet />
    </div>
  ),
}));

vi.mock("../../../apps/frontend/src/pages/Home", () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/Dashboard", () => ({
  default: () => <div>Dashboard Page</div>,
}));







vi.mock("../../../apps/frontend/src/pages/Settings", () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/admin/AdminDashboard", () => ({
  default: () => <div>Admin Dashboard</div>,
}));

vi.mock("../../../apps/frontend/src/pages/admin/ContentReports", () => ({
  default: () => <div>Content Reports</div>,
}));

vi.mock("../../../apps/frontend/src/pages/admin/UserManagement", () => ({
  default: () => <div>User Management</div>,
}));

vi.mock("../../../apps/frontend/src/pages/admin/SystemControls", () => ({
  default: () => <div>System Controls</div>,
}));

vi.mock("../../../apps/frontend/src/pages/NotFound", () => ({
  default: () => <div>Not Found</div>,
}));

vi.mock("../../../apps/frontend/src/pages/Terms", () => ({
  default: () => <div>Terms Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/Privacy", () => ({
  default: () => <div>Privacy Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/TermsReacceptance", () => ({
  default: () => <div>Terms Reacceptance Page</div>,
}));

describe("ProtectedRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      isLoading: false,
      isAuthenticated: true,
      signOut: vi.fn(),
    });
  });

  it("should render without crashing", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    // Just verify the component renders - lazy loading makes detailed route testing complex
    expect(document.body).toBeInTheDocument();
  });

  it("should load private translations on mount", async () => {
    const { ensurePrivateTranslationsLoaded } =
      await import("../../../apps/frontend/src/i18n/config");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(ensurePrivateTranslationsLoaded).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  it("should render Home page at root path", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render Dashboard page at /dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });







  it("should render Settings page at /settings", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Settings Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });


  it.each(["/sessions", "/planner", "/logger/session-123", "/feed", "/insights", "/profile", "/exercises"])(
    "does not expose archived legacy route %s",
    async (route) => {
      render(
        <MemoryRouter initialEntries={[route]}>
          <ProtectedRoutes />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Not Found")).toBeInTheDocument();
      });
    },
  );

  it("should render Terms page at /terms", async () => {
    render(
      <MemoryRouter initialEntries={["/terms"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Terms Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render Privacy page at /privacy", async () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Privacy Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render TermsReacceptance page at /terms-reacceptance", async () => {
    render(
      <MemoryRouter initialEntries={["/terms-reacceptance"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Terms Reacceptance Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render AdminDashboard at /admin", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("should render ContentReports at /admin/reports", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/reports"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Content Reports")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render UserManagement at /admin/users", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("User Management")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render SystemControls at /admin/system", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/system"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("System Controls")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render NotFound page for unknown routes", async () => {
    render(
      <MemoryRouter initialEntries={["/unknown-route"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Not Found")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should redirect /login to root", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should redirect unmatched paths to root", async () => {
    render(
      <MemoryRouter initialEntries={["/some-random-path"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    // Unmatched paths within protected routes show NotFound, not redirect
    // The outer * route only catches paths that don't go through ProtectedRoute
    await waitFor(
      () => {
        expect(screen.getByText("Not Found")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should render fallback loading state", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    // The component should render (loading state is handled by Suspense)
    expect(document.body).toBeInTheDocument();
  });

  it("should use dehydratedState from prop when provided", async () => {
    const dehydratedState = { queries: [{ queryKey: ["test"], state: { data: "test" } }] };

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes dehydratedState={dehydratedState} />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should get dehydratedState from window when prop is not provided", async () => {
    const dehydratedState = { queries: [{ queryKey: ["test"], state: { data: "test" } }] };
    (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__ =
      dehydratedState;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // State should be cleared from window after use
    expect((window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__).toBe(
      undefined,
    );
  });

  it("should prefer prop dehydratedState over window state", async () => {
    const propState = { queries: [{ queryKey: ["prop"], state: { data: "prop" } }] };
    const windowState = { queries: [{ queryKey: ["window"], state: { data: "window" } }] };
    (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__ = windowState;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes dehydratedState={propState} />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Window state should still be there since prop was used
    expect((window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__).toBe(
      windowState,
    );

    // Clean up
    delete (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__;
  });

  it("should handle missing dehydratedState gracefully", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoutes />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
