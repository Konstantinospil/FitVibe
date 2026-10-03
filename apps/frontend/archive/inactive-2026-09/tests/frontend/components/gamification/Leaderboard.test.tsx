import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Leaderboard } from "../../src/components/gamification/Leaderboard";

const getLeaderboard = vi.fn();

vi.mock("../../src/services/api", () => ({
  getLeaderboard: (...args: unknown[]) => getLeaderboard(...args),
}));

describe("Leaderboard", () => {
  beforeEach(() => {
    getLeaderboard.mockReset();
  });

  it("shows loading state while fetching", () => {
    getLeaderboard.mockImplementation(() => new Promise(() => {}));

    render(<Leaderboard />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows empty state when fetch fails", async () => {
    getLeaderboard.mockRejectedValueOnce(new Error("Boom"));

    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText("No rankings yet")).toBeInTheDocument());
  });

  it("renders empty state when no entries exist", async () => {
    getLeaderboard.mockResolvedValueOnce({
      entries: [],
      total: 0,
      type: "global",
      period: "month",
    });

    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText("No rankings yet")).toBeInTheDocument());
  });

  it("renders ranked entries and the leaderboard title", async () => {
    getLeaderboard.mockResolvedValueOnce({
      entries: [
        {
          userId: "user-1",
          username: "coach",
          displayName: "Coach",
          points: 1000,
          rank: 1,
          badgesCount: 3,
        },
        {
          userId: "user-2",
          username: "spotter",
          displayName: undefined,
          points: 500,
          rank: 2,
          badgesCount: 1,
        },
      ],
      total: 2,
      type: "global",
      period: "month",
    });

    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText("Leaderboard")).toBeInTheDocument());
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("@coach")).toBeInTheDocument();
    expect(screen.getByText("spotter")).toBeInTheDocument();
    expect(screen.getByText((1000).toLocaleString())).toBeInTheDocument();
  });
});
