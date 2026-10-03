import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreakDisplay } from "../../src/components/progress/StreakDisplay";

describe("StreakDisplay", () => {
  it("renders current streak and badge", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={10} unit="days" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Best: 10 days")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
  });
});
