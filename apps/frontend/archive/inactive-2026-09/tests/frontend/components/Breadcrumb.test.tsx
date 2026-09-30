import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "../../src/components/Breadcrumb";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

describe("Breadcrumb", () => {
  const renderBreadcrumb = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Breadcrumb />
      </MemoryRouter>,
    );

  it("renders only Home for the root path", () => {
    renderBreadcrumb("/");

    const home = screen.getByText("Home");
    expect(home).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });

  it("skips dynamic segments in the middle and uses the last segment", () => {
    renderBreadcrumb("/sessions/123/details");

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sessions" })).toHaveAttribute("href", "/sessions");
    expect(screen.queryByText("123")).not.toBeInTheDocument();

    const current = screen.getByText("details");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders breadcrumb items across mapped segments", () => {
    renderBreadcrumb(
      "/settings/profile/sessions/planner/logger/insights/admin/reports/users/system/translations/terms/privacy/cookie/impressum/contact",
    );

    const labels = [
      "Home",
      "settings",
      "profile",
      "sessions",
      "planner",
      "logger",
      "insights",
      "admin",
      "reports",
      "users",
      "system",
      "translations",
      "terms",
      "privacy",
      "cookie",
      "impressum",
      "contact",
    ];

    labels.slice(0, -1).forEach((label) => {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    });

    const current = screen.getByText("contact");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("updates link styles on hover", () => {
    renderBreadcrumb("/sessions");

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveStyle({ color: "var(--color-text-secondary)" });

    fireEvent.mouseEnter(homeLink);
    expect(homeLink).toHaveStyle({ color: "var(--color-accent)" });

    fireEvent.mouseLeave(homeLink);
    expect(homeLink).toHaveStyle({ color: "var(--color-text-secondary)" });
  });
});
