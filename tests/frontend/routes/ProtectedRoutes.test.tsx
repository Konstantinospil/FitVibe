import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Outlet } from "react-router-dom";
import ProtectedRoutes from "../../../apps/frontend/src/routes/ProtectedRoutes";
import { useAuth } from "../../../apps/frontend/src/contexts/AuthContext";
import {
  DEHYDRATED_STATE_ELEMENT_ID,
  serializeDehydratedState,
} from "../../../apps/frontend/src/ssr/dehydratedState";

vi.mock("../../../apps/frontend/src/contexts/AuthContext");
vi.mock("../../../apps/frontend/src/i18n/config", () => ({
  default: { changeLanguage: vi.fn().mockResolvedValue(undefined), t: (key: string) => key },
  ensurePrivateTranslationsLoaded: vi.fn().mockResolvedValue(undefined),
  loadLanguageTranslations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../apps/frontend/src/services/api", () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ language: "de", measurementSystem: "metric" }),
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

vi.mock("../../../apps/frontend/src/pages/Library", () => ({
  default: () => <div>Library Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/Dashboard", () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock("../../../apps/frontend/src/pages/Settings", () => ({
  default: () => <div>Settings Page</div>,
}));


vi.mock("../../../apps/frontend/src/pages/AppSurfacePlaceholder", () => ({
  default: ({ title }: { title: string }) => <div>{title} Page</div>,
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

  it("loads the signed-in account language before displaying protected content", async () => {
    const { getUserPreferences } = await import("../../../apps/frontend/src/services/api");
    const { default: i18n, loadLanguageTranslations } =
      await import("../../../apps/frontend/src/i18n/config");
    let resolvePreferences!: (value: { language: "el"; measurementSystem: "metric" }) => void;
    vi.mocked(getUserPreferences).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreferences = resolve;
      }),
    );

    renderRoute("/");
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    resolvePreferences({ language: "el", measurementSystem: "metric" });

    await waitFor(() => {
      expect(loadLanguageTranslations).toHaveBeenCalledWith("el");
      expect(i18n.changeLanguage).toHaveBeenCalledWith("el");
    });
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("still renders private routes when account preferences cannot be loaded", async () => {
    const { getUserPreferences } = await import("../../../apps/frontend/src/services/api");
    const { default: i18n } = await import("../../../apps/frontend/src/i18n/config");
    vi.mocked(getUserPreferences).mockRejectedValueOnce(new Error("Unavailable"));

    renderRoute("/");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
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
    ["/library", "Library Page"],
    ["/dashboard", "Dashboard Page"],
    ["/settings", "Settings Page"],
  ])("renders canonical app route %s", async (route, expectedText) => {
    renderRoute(route);
    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });

  it.each([
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
  ])("redirects retired route %s to Home", async (route) => {
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

  it("consumes inert dehydrated state from the document when no prop is supplied", async () => {
    const dehydratedState = {
      queries: [{ queryKey: ["test"], state: { data: "test" } }],
      mutations: [],
    };
    const template = document.createElement("template");
    template.id = DEHYDRATED_STATE_ELEMENT_ID;
    template.content.textContent = serializeDehydratedState(dehydratedState as never);
    document.body.appendChild(template);

    renderRoute("/");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(document.getElementById(DEHYDRATED_STATE_ELEMENT_ID)).toBeNull();
  });

  it("prefers prop dehydrated state without consuming document state", async () => {
    const propState = {
      queries: [{ queryKey: ["prop"], state: { data: "prop" } }],
      mutations: [],
    };
    const documentState = {
      queries: [{ queryKey: ["document"], state: { data: "document" } }],
      mutations: [],
    };
    const template = document.createElement("template");
    template.id = DEHYDRATED_STATE_ELEMENT_ID;
    template.content.textContent = serializeDehydratedState(documentState as never);
    document.body.appendChild(template);

    renderRoute("/", propState);
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(document.getElementById(DEHYDRATED_STATE_ELEMENT_ID)).not.toBeNull();

    template.remove();
  });
});
