import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointsDisplay } from "../../src/components/gamification/PointsDisplay";

const getPointsBalance = vi.fn();

vi.mock("../../src/services/api", () => ({
  getPointsBalance: (...args: unknown[]) => getPointsBalance(...args),
}));

describe("PointsDisplay", () => {
  beforeEach(() => {
    getPointsBalance.mockReset();
  });

  it("renders the total points balance", async () => {
    getPointsBalance.mockResolvedValue({ total: 1234 });

    render(<PointsDisplay />);

    await waitFor(() => expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument());
    expect(screen.getByText("Total points")).toBeInTheDocument();
  });

  it("renders recent events when requested", async () => {
    getPointsBalance.mockResolvedValue({
      total: 50,
      recentEvents: [
        {
          id: "evt-1",
          type: "session",
          points: 10,
          description: "Session complete",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
    });

    render(<PointsDisplay showRecentEvents />);

    await waitFor(() => expect(screen.getByText("Session complete")).toBeInTheDocument());
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
  });
});
