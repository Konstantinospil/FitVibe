import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "../../src/components/ui/Breadcrumbs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Breadcrumbs", () => {
  it("returns nothing when there are no items", () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs items={[]} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders home, intermediate links, and the current page", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          homeTo="/dashboard"
          items={[{ label: "Sessions", to: "/sessions" }, { label: "Details" }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "navigation.breadcrumbs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "navigation.home" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Sessions" })).toHaveAttribute("href", "/sessions");
    expect(screen.getByText("Details")).toHaveAttribute("aria-current", "page");
  });

  it("renders a non-link intermediate item when to is omitted", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: "Category" }, { label: "Current" }]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Category")).not.toHaveAttribute("href");
    expect(screen.getByText("Current")).toHaveAttribute("aria-current", "page");
  });
});
