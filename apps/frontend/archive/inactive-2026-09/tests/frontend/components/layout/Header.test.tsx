import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Header } from "../../src/components/layout/Header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function DummyIcon() {
  return <svg data-testid="nav-icon" />;
}

describe("Header", () => {
  it("renders logo, nav items, and right content", () => {
    render(
      <MemoryRouter>
        <Header
          logo={<span>FitVibe</span>}
          navItems={[{ to: "/dashboard", labelKey: "navigation.dashboard", icon: DummyIcon }]}
          rightContent={<button type="button">Account</button>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("FitVibe")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "navigation.main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "navigation.dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByTestId("nav-icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
  });

  it("renders without optional slots", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "navigation.main" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
