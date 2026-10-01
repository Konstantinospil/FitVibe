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

vi.mock("../../../apps/frontend/src/components/ProtectedRoute", () => ({
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

vi.mock("../../../apps/frontend/src/pages/Calendar", () => ({
  default: () => <div>Calendar Page</div>,
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

  const renderRoute = (route: string, dehydratedState?: unknown) =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <ProtectedRoutes dehydratedState={dehydratedState as never} />
      </MemoryRouter>,
    );

  it("renders without crashing", () => {
    renderRoute("/");
    expect(document.body).toBeInTheDocument();
  });

  it("loads private translations on mount", async () => {
    const { ensurePrivateTranslationsLoaded } =
      await import("../../../apps/frontend/src/i18n/config");

    renderRoute("/");

    await waitFor(() => {
      expect(ensurePrivateTranslationsLoaded).toHaveBeenCalled();
    });
  });

  it("renders Home at the authenticated root", async () => {
    renderRoute("/");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("renders Calendar at the active calendar route", async () => {
    renderRoute("/calendar");
    expect(await screen.findByText("Calendar Page")).toBeInTheDocument();
  });

  it.each([
    "/dashboard",
    "/settings",
    "/sessions",
    "/planner",
    "/logger/session-123",
    "/feed",
    "/insights",
    "/profile",
    "/exercises",
    "/admin",
    "/admin/reports",
    "/admin/users",
    "/admin/system",
    "/unknown-route",
  ])("redirects inactive route %s to Home", async (route) => {
    renderRoute(route);
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("renders Terms", async () => {
    renderRoute("/terms");
    expect(await screen.findByText("Terms Page")).toBeInTheDocument();
  });

  it("renders Privacy", async () => {
    renderRoute("/privacy");
    expect(await screen.findByText("Privacy Page")).toBeInTheDocument();
  });

  it("renders TermsReacceptance", async () => {
    renderRoute("/terms-reacceptance");
    expect(await screen.findByText("Terms Reacceptance Page")).toBeInTheDocument();
  });

  it("redirects /login to Home for authenticated users", async () => {
    renderRoute("/login");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("renders while private translations are loading", () => {
    renderRoute("/");
    expect(document.body).toBeInTheDocument();
  });

  it("uses dehydrated state supplied by props", async () => {
    const dehydratedState = { queries: [{ queryKey: ["test"], state: { data: "test" } }] };
    renderRoute("/", dehydratedState);
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("consumes dehydrated state from window when no prop is supplied", async () => {
    const dehydratedState = { queries: [{ queryKey: ["test"], state: { data: "test" } }] };
    (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__ =
      dehydratedState;

    renderRoute("/");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect((window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__).toBe(
      undefined,
    );
  });

  it("prefers prop dehydrated state over window state", async () => {
    const propState = { queries: [{ queryKey: ["prop"], state: { data: "prop" } }] };
    const windowState = { queries: [{ queryKey: ["window"], state: { data: "window" } }] };
    (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__ = windowState;

    renderRoute("/", propState);
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect((window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__).toBe(
      windowState,
    );

    delete (window as unknown as { __REACT_QUERY_STATE__?: unknown }).__REACT_QUERY_STATE__;
  });
});
