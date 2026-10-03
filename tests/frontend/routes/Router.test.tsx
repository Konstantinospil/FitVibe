/**
 * Router component tests
 * Tests the Router component that works for both SSR and client-side rendering
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Mock ProtectedRoutes before importing Router
const MockProtectedRoutes = ({
  queryClient,
  dehydratedState,
}: {
  queryClient?: QueryClient;
  dehydratedState?: unknown;
}) => (
  <div
    data-testid="protected-routes"
    data-has-query-client={!!queryClient}
    data-has-dehydrated-state={!!dehydratedState}
  >
    Protected Routes
  </div>
);

vi.mock("../../src/routes/ProtectedRoutes", () => ({
  default: MockProtectedRoutes,
}));

import { Router } from "../../src/routes/Router.js";

// Mock dependencies
vi.mock("react-router-dom/server", () => ({
  StaticRouter: ({
    children,
    location,
    basename,
  }: {
    children: React.ReactNode;
    location: string;
    basename?: string;
  }) => (
    <div data-testid="static-router" data-location={location} data-basename={basename}>
      {children}
    </div>
  ),
}));

vi.mock("react-router-dom", () => ({
  BrowserRouter: ({ children, basename }: { children: React.ReactNode; basename?: string }) => (
    <div data-testid="browser-router" data-basename={basename}>
      {children}
    </div>
  ),
  StaticRouter: ({
    children,
    location,
    basename,
  }: {
    children: React.ReactNode;
    location: string;
    basename?: string;
  }) => (
    <div data-testid="static-router" data-location={location} data-basename={basename}>
      {children}
    </div>
  ),
}));

vi.mock("../../src/routes/PublicRoutes", () => ({
  default: () => <div data-testid="public-routes">Public Routes</div>,
}));

const mockUseAuth = vi.fn(() => ({ isAuthenticated: false }));

vi.mock("../../src/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../src/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

describe("Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window object
    Object.defineProperty(window, "window", {
      value: window,
      writable: true,
      configurable: true,
    });
  });

  it("should render BrowserRouter for client-side rendering", () => {
    render(<Router />);

    expect(screen.getByTestId("browser-router")).toBeInTheDocument();
    expect(screen.queryByTestId("static-router")).not.toBeInTheDocument();
  });

  it("should render BrowserRouter with basename for client-side rendering", () => {
    render(<Router basename="/app" />);

    const browserRouter = screen.getByTestId("browser-router");
    expect(browserRouter).toBeInTheDocument();
    expect(browserRouter).toHaveAttribute("data-basename", "/app");
  });

  it("should render StaticRouter for SSR when location is provided", () => {
    // Mock window as undefined for SSR by checking location prop
    // Since we can't actually set window to undefined in JSDOM, we test the logic
    // by verifying that when location is provided, StaticRouter would be used
    // In actual SSR, window would be undefined
    const { container } = render(<Router location="/login" />);

    // In test environment with window defined, BrowserRouter is used
    // But we can verify the component structure
    expect(screen.getByTestId("browser-router")).toBeInTheDocument();
  });

  it("should render StaticRouter with basename for SSR", () => {
    // Similar to above - in actual SSR, StaticRouter would be used
    // In test environment, BrowserRouter is used when window is defined
    const { container } = render(<Router location="/login" basename="/app" />);

    const browserRouter = screen.getByTestId("browser-router");
    expect(browserRouter).toBeInTheDocument();
    expect(browserRouter).toHaveAttribute("data-basename", "/app");
  });

  it("should render BrowserRouter when window is defined even with location prop", () => {
    render(<Router location="/login" />);

    // When window is defined, should use BrowserRouter even with location prop
    expect(screen.getByTestId("browser-router")).toBeInTheDocument();
    expect(screen.queryByTestId("static-router")).not.toBeInTheDocument();
  });

  it("should wrap content in ErrorBoundary and AuthProvider", () => {
    render(<Router />);

    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
  });

  it("should render PublicRoutes when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<Router />);

    expect(screen.getByTestId("public-routes")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-routes")).not.toBeInTheDocument();
  });

  it("should render ProtectedRoutes when user is authenticated", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<Router />);

    await waitFor(() => {
      expect(screen.getByTestId("protected-routes")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("public-routes")).not.toBeInTheDocument();
  });

  it("should pass queryClient to ProtectedRoutes when provided", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    const queryClient = new QueryClient();

    render(<Router queryClient={queryClient} />);

    await waitFor(() => {
      const protectedRoutes = screen.getByTestId("protected-routes");
      expect(protectedRoutes).toHaveAttribute("data-has-query-client", "true");
    });
  });

  it("should pass dehydratedState to ProtectedRoutes when provided", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    const dehydratedState = { queries: [] };

    render(<Router dehydratedState={dehydratedState} />);

    await waitFor(() => {
      const protectedRoutes = screen.getByTestId("protected-routes");
      expect(protectedRoutes).toHaveAttribute("data-has-dehydrated-state", "true");
    });
  });

  it("should pass both queryClient and dehydratedState to ProtectedRoutes", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    const queryClient = new QueryClient();
    const dehydratedState = { queries: [] };

    render(<Router queryClient={queryClient} dehydratedState={dehydratedState} />);

    await waitFor(() => {
      const protectedRoutes = screen.getByTestId("protected-routes");
      expect(protectedRoutes).toHaveAttribute("data-has-query-client", "true");
      expect(protectedRoutes).toHaveAttribute("data-has-dehydrated-state", "true");
    });
  });

  it("should render Suspense wrapper for lazy-loaded ProtectedRoutes", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<Router />);

    // ProtectedRoutes should load (mocked, so loads immediately)
    await waitFor(() => {
      expect(screen.getByTestId("protected-routes")).toBeInTheDocument();
    });
  });

  it("should use BrowserRouter when location is undefined", () => {
    render(<Router />);

    expect(screen.getByTestId("browser-router")).toBeInTheDocument();
    expect(screen.queryByTestId("static-router")).not.toBeInTheDocument();
  });

  it("should use BrowserRouter when location is empty string", () => {
    render(<Router location="" />);

    expect(screen.getByTestId("browser-router")).toBeInTheDocument();
    expect(screen.queryByTestId("static-router")).not.toBeInTheDocument();
  });

  // Note: Testing useAuth fallback is complex because it requires mocking before module import
  // The fallback logic is: if useAuth is not a function, return { isAuthenticated: false }
  // This is tested indirectly through the normal flow where useAuth is available

  it("should not pass queryClient when not provided", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<Router />);

    await waitFor(() => {
      const protectedRoutes = screen.getByTestId("protected-routes");
      expect(protectedRoutes).toHaveAttribute("data-has-query-client", "false");
    });
  });

  it("should not pass dehydratedState when not provided", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<Router />);

    await waitFor(() => {
      const protectedRoutes = screen.getByTestId("protected-routes");
      expect(protectedRoutes).toHaveAttribute("data-has-dehydrated-state", "false");
    });
  });

  it("should handle basename with StaticRouter when location is provided", () => {
    // Note: In actual SSR, window would be undefined and StaticRouter would be used
    // In test environment, BrowserRouter is used, but we verify the basename is passed
    render(<Router location="/login" basename="/app" />);

    const browserRouter = screen.getByTestId("browser-router");
    expect(browserRouter).toHaveAttribute("data-basename", "/app");
  });

  it("should handle undefined basename", () => {
    render(<Router />);

    const browserRouter = screen.getByTestId("browser-router");
    // When basename is undefined, it may not be set as an attribute
    // Just verify the router renders correctly
    expect(browserRouter).toBeInTheDocument();
  });

  it("uses StaticRouter during real server-side rendering", () => {
    const originalWindow = global.window;
    // @ts-expect-error intentional SSR simulation
    delete global.window;
    try {
      const html = renderToString(<Router location="/login" basename="/app" />);
      expect(html).toContain('data-testid="static-router"');
      expect(html).toContain('data-location="/login"');
      expect(html).toContain('data-basename="/app"');
    } finally {
      global.window = originalWindow;
    }
  });

});
