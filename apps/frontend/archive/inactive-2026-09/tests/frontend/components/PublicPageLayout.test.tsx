import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PublicPageLayout from "../../src/components/PublicPageLayout";

vi.mock("../../src/utils/idleScheduler", () => ({
  scheduleIdleTask: (cb: () => void) => {
    cb();
    return { cancel: vi.fn() };
  },
}));

vi.mock("../../src/components/ThemeToggle", () => ({
  default: () => <button type="button">Theme</button>,
}));

vi.mock("../../src/components/LanguageSwitcher", () => ({
  default: () => <button type="button">Language</button>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PublicPageLayout", () => {
  it("wraps children in main and includes the footer", () => {
    render(
      <MemoryRouter>
        <PublicPageLayout>
          <p>Legal copy</p>
        </PublicPageLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("Legal copy").closest("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders theme and language controls", () => {
    render(
      <MemoryRouter>
        <PublicPageLayout>
          <p>Legal copy</p>
        </PublicPageLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
  });
});
