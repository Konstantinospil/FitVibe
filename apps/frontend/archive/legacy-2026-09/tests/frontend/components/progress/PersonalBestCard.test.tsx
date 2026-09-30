import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalBestCard } from "../../src/components/progress/PersonalBestCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PersonalBestCard", () => {
  it("renders a loading skeleton", () => {
    render(<PersonalBestCard records={[]} loading />);
    expect(screen.getByText("dashboard.personalBests")).toBeInTheDocument();
  });

  it("renders a custom empty message", () => {
    render(<PersonalBestCard records={[]} emptyMessage="No PRs yet" />);
    expect(screen.getByText("No PRs yet")).toBeInTheDocument();
  });

  it("renders the default empty message", () => {
    render(<PersonalBestCard records={[]} />);
    expect(screen.getByText("No personal bests recorded yet")).toBeInTheDocument();
  });

  it("lists personal best records", () => {
    render(
      <PersonalBestCard
        records={[{ lift: "Squat", value: "140 kg", achieved: "2026-01-01", visibility: "public" }]}
      />,
    );

    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("140 kg")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
  });
});
