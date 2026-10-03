import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import AdminRoute from "../../src/components/AdminRoute";
import { useAuthStore } from "../../src/store/auth.store";

// Mock auth store
vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: vi.fn(),
}));

// Mock child components
vi.mock("../../src/components/PageIntro", () => ({
  default: ({ children, title, description }: any) => (
    <div data-testid="page-intro">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

vi.mock("../../src/components/ui/Card", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, style }: any) => (
    <div data-testid="card-title" style={style}>
      {children}
    </div>
  ),
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

const AdminChild = () => <div>Admin Dashboard</div>;

const renderAdminRoute = () => {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route index element={<AdminChild />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const getContainer = () => {
  return document.body;
};

describe("AdminRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects to login when not authenticated", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = renderAdminRoute();

    await waitFor(
      () => {
        const loginPages = screen.getAllByText("Login Page");
        const loginPage = Array.from(loginPages).find((el) => container.contains(el));
        expect(loginPage).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    const dashboards = screen.queryAllByText("Admin Dashboard");
    const dashboard = dashboards.find((el) => container.contains(el));
    expect(dashboard).toBeUndefined();
  });

  it("shows access denied page when authenticated but not admin", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: {
        id: "123",
        username: "athlete",
        email: "athlete@example.com",
        role: "athlete",
        isVerified: true,
        createdAt: new Date().toISOString(),
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = renderAdminRoute();

    const requiredTexts = screen.getAllByText("Administrator Access Required");
    const requiredText =
      Array.from(requiredTexts).find((el) => container.contains(el)) || requiredTexts[0];
    expect(requiredText).toBeInTheDocument();

    const permissionTexts = screen.getAllByText("You do not have permission to access this area");
    const permissionText =
      Array.from(permissionTexts).find((el) => container.contains(el)) || permissionTexts[0];
    expect(permissionText).toBeInTheDocument();

    const unauthorizedTexts = screen.getAllByText("Unauthorized Access");
    const unauthorizedText =
      Array.from(unauthorizedTexts).find((el) => container.contains(el)) || unauthorizedTexts[0];
    expect(unauthorizedText).toBeInTheDocument();

    const dashboards = screen.queryAllByText("Admin Dashboard");
    const dashboard = dashboards.find((el) => container.contains(el));
    expect(dashboard).toBeUndefined();
  });

  it("displays access denied card with security message", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: {
        id: "123",
        username: "coach",
        email: "coach@example.com",
        role: "coach",
        isVerified: true,
        createdAt: new Date().toISOString(),
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = renderAdminRoute();

    const privilegeTexts = screen.getAllByText(
      "You need administrator privileges to access the admin dashboard.",
    );
    const privilegeText =
      Array.from(privilegeTexts).find((el) => container.contains(el)) || privilegeTexts[0];
    expect(privilegeText).toBeInTheDocument();

    const contactTexts = screen.getAllByText(
      "If you believe you should have access, please contact your system administrator.",
    );
    const contactText =
      Array.from(contactTexts).find((el) => container.contains(el)) || contactTexts[0];
    expect(contactText).toBeInTheDocument();
  });

  it("renders admin content when authenticated as admin", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: {
        id: "123",
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        isVerified: true,
        createdAt: new Date().toISOString(),
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = renderAdminRoute();

    const dashboards = screen.getAllByText("Admin Dashboard");
    const dashboard = Array.from(dashboards).find((el) => container.contains(el)) || dashboards[0];
    expect(dashboard).toBeInTheDocument();

    const requiredTexts = screen.queryAllByText("Administrator Access Required");
    const requiredText = requiredTexts.find((el) => container.contains(el));
    expect(requiredText).toBeUndefined();
  });

  it("uses PageIntro component for access denied page", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: {
        id: "123",
        username: "athlete",
        email: "athlete@example.com",
        role: "athlete",
        isVerified: true,
        createdAt: new Date().toISOString(),
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });

    const { container } = renderAdminRoute();

    const pageIntros = screen.getAllByTestId("page-intro");
    const pageIntro = Array.from(pageIntros).find((el) => container.contains(el)) || pageIntros[0];
    expect(pageIntro).toBeInTheDocument();

    const cards = screen.getAllByTestId("card");
    const card = Array.from(cards).find((el) => container.contains(el)) || cards[0];
    expect(card).toBeInTheDocument();
  });
});
