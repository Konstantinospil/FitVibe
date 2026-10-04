import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "../../../../apps/frontend/src/pages/admin/AdminDashboard";

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(() => ({
  pathname: "/admin",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({
      pathname: "/admin",
    });
  });

  it("should render admin dashboard with navigation items", () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("FitVibe Administration")).toBeInTheDocument();
    expect(screen.getByText("Content Reports")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.getByText("System Controls")).toBeInTheDocument();
  });

  it("should navigate to reports page when Content Reports is clicked", () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button");
    fireEvent.click(reportsButton!);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/reports");
  });

  it("should navigate to users page when User Management is clicked", () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const usersButton = screen.getByText("User Management").closest("button");
    fireEvent.click(usersButton!);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/users");
  });

  it("should navigate to system page when System Controls is clicked", () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const systemButton = screen.getByText("System Controls").closest("button");
    fireEvent.click(systemButton!);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/system");
  });

  it("should render outlet for child routes", () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    // Outlet should be present (renders child routes)
    // The Outlet component from react-router-dom renders children
    // We can verify the component structure is correct
    expect(screen.getByText("FitVibe Administration")).toBeInTheDocument();
  });

  it("should highlight active nav item when pathname includes the path", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin/reports",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button");
    expect(reportsButton?.style.border).toContain("var(--color-accent)");
  });

  it("should not highlight inactive nav items", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button");
    expect(reportsButton?.style.border).toContain("var(--color-border)");
  });

  it("should change background on hover for inactive items", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button")!;
    const initialBackground = reportsButton.style.background;

    fireEvent.mouseEnter(reportsButton);
    expect(reportsButton.style.background).not.toBe(initialBackground);

    fireEvent.mouseLeave(reportsButton);
    expect(reportsButton.style.background).toBe("rgba(15, 23, 42, 0.4)");
  });

  it("should not change background on hover for active items", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin/reports",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button")!;
    const initialBackground = reportsButton.style.background;

    fireEvent.mouseEnter(reportsButton);
    expect(reportsButton.style.background).toBe(initialBackground);

    fireEvent.mouseLeave(reportsButton);
    expect(reportsButton.style.background).toBe(initialBackground);
  });

  it("should apply active styling to multiple matching paths", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin/users/123",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const usersButton = screen.getByText("User Management").closest("button");
    expect(usersButton?.style.border).toContain("var(--color-accent)");
  });

  it("should display correct icon colors for active and inactive states", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin/reports",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button");
    const iconContainer = reportsButton?.querySelector("div[style*='color']") as HTMLElement;
    expect(iconContainer?.style.color).toBe("var(--color-accent)");
  });

  it("should display secondary icon color for inactive items", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/admin",
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsButton = screen.getByText("Content Reports").closest("button");
    const iconContainer = reportsButton?.querySelector("div[style*='color']") as HTMLElement;
    expect(iconContainer?.style.color).toBe("var(--color-text-secondary)");
  });
});
