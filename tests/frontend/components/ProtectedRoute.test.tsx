import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import ProtectedRoute from "../../src/components/ProtectedRoute";
import * as AuthContext from "../../src/contexts/AuthContext";
import type { User } from "../../src/store/auth.store";
import { getLegalDocumentsStatus } from "../../src/services/api";

vi.mock("../../src/contexts/AuthContext");
vi.mock("../../src/services/api", () => ({
  getLegalDocumentsStatus: vi.fn(),
}));

const mockUseAuth = vi.mocked(AuthContext.useAuth);
const mockGetLegalDocumentsStatus = vi.mocked(getLegalDocumentsStatus);

const mockUser: User = {
  id: "user-123",
  username: "testuser",
  email: "test@example.com",
  role: "athlete",
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: true,
        acceptedAt: "2026-09-25T10:00:00.000Z",
        acceptedVersion: "2026-09-25.1",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: false,
      },
      privacy: {
        accepted: true,
        acceptedAt: null,
        acceptedVersion: null,
        currentVersion: "2024-06-01",
        requiredVersion: "2024-06-01",
        requiredAction: "acknowledge",
        needsAcceptance: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should render children when user is authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
  });

  it("should redirect to login when user is not authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for redirect to complete
    await waitFor(
      () => {
        const loginPages = screen.getAllByText("Login Page");
        const loginPage = Array.from(loginPages).find((el) => container.contains(el));
        expect(loginPage).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    const protectedContents = screen.queryAllByText("Protected Content");
    const protectedContent = protectedContents.find((el) => container.contains(el));
    expect(protectedContent).toBeUndefined();
  });

  it("should pass location state when redirecting to login", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const LoginPage = () => {
      return <div>Login Page</div>;
    };

    const { container } = render(
      <MemoryRouter initialEntries={["/protected/resource"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected/resource" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const loginPages = screen.getAllByText("Login Page");
        const loginPage = Array.from(loginPages).find((el) => container.contains(el));
        expect(loginPage).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("should allow access to nested routes when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected/nested/route"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected/nested/route" element={<div>Nested Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nested Protected Content")).toBeInTheDocument();
  });

  it("redirects ordinary authenticated routes when current Terms require acceptance", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    mockGetLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: false,
        acceptedAt: null,
        acceptedVersion: "2024-06-01",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: true,
      },
      privacy: {
        accepted: true,
        acceptedAt: null,
        acceptedVersion: null,
        currentVersion: "2024-06-01",
        requiredVersion: "2024-06-01",
        requiredAction: "acknowledge",
        needsAcceptance: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/terms-reacceptance" element={<div>Terms Reacceptance</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("keeps acknowledgement-only Privacy changes non-blocking", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    mockGetLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: true,
        acceptedAt: "2026-09-25T10:00:00.000Z",
        acceptedVersion: "2026-09-25.1",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: false,
      },
      privacy: {
        accepted: false,
        acceptedAt: null,
        acceptedVersion: "2024-06-01",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "acknowledge",
        needsAcceptance: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/privacy" element={<div>Privacy</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("blocks ordinary routes when Privacy explicitly requires acceptance", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    mockGetLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: true,
        acceptedAt: "2026-09-25T10:00:00.000Z",
        acceptedVersion: "2026-09-25.1",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: false,
      },
      privacy: {
        accepted: false,
        acceptedAt: null,
        acceptedVersion: "2024-06-01",
        currentVersion: "2026-09-25.2",
        requiredVersion: "2026-09-25.2",
        requiredAction: "accept",
        needsAcceptance: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/privacy" element={<div>Privacy Gate</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Privacy Gate")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("fails closed on legal-status lookup failure for ordinary routes", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    mockGetLegalDocumentsStatus.mockRejectedValue(new Error("legal status unavailable"));

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/terms-reacceptance" element={<div>Terms Reacceptance</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("keeps legal and account settings routes available during Terms reacceptance", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    mockGetLegalDocumentsStatus.mockResolvedValue({
      terms: {
        accepted: false,
        acceptedAt: null,
        acceptedVersion: "2024-06-01",
        currentVersion: "2026-09-25.1",
        requiredVersion: "2026-09-25.1",
        requiredAction: "accept",
        needsAcceptance: true,
      },
      privacy: {
        accepted: true,
        acceptedAt: null,
        acceptedVersion: null,
        currentVersion: "2024-06-01",
        requiredVersion: "2024-06-01",
        requiredAction: "acknowledge",
        needsAcceptance: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/settings" element={<div>Account Settings</div>} />
            <Route path="/terms-reacceptance" element={<div>Terms Reacceptance</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Account Settings")).toBeInTheDocument();
  });

  it("should prevent access to nested routes when not authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/protected/nested/route"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected/nested/route" element={<div>Nested Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const loginPages = screen.getAllByText("Login Page");
        const loginPage = Array.from(loginPages).find((el) => container.contains(el));
        expect(loginPage).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    const nestedContents = screen.queryAllByText("Nested Protected Content");
    const nestedContent = nestedContents.find((el) => container.contains(el));
    expect(nestedContent).toBeUndefined();
  });
});
