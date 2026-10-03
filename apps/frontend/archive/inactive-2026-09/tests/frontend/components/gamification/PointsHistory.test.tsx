import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointsHistory } from "../../src/components/gamification/PointsHistory";

const getPointsHistory = vi.fn();

vi.mock("../../src/services/api", () => ({
  getPointsHistory: (...args: unknown[]) => getPointsHistory(...args),
}));

describe("PointsHistory", () => {
  beforeEach(() => {
    getPointsHistory.mockReset();
  });

  it("shows empty state when no history is returned", async () => {
    getPointsHistory.mockResolvedValue({
      entries: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    render(<PointsHistory />);

    await waitFor(() => expect(screen.getByText("No points history yet")).toBeInTheDocument());
  });

  it("renders history and paginates", async () => {
    getPointsHistory
      .mockResolvedValueOnce({
        entries: [
          {
            id: "1",
            points: 10,
            description: "Session complete",
            createdAt: "2024-01-01T00:00:00Z",
          },
        ],
        total: 21,
        limit: 20,
        offset: 0,
      })
      .mockResolvedValueOnce({
        entries: [
          {
            id: "2",
            points: 5,
            description: "Streak bonus",
            createdAt: "2024-01-02T00:00:00Z",
          },
        ],
        total: 21,
        limit: 20,
        offset: 20,
      });

    render(<PointsHistory limit={20} />);

    await waitFor(() => expect(screen.getByText("Session complete")).toBeInTheDocument());
    expect(screen.getByText("+10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(screen.getByText("Streak bonus")).toBeInTheDocument());
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(getPointsHistory).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(getPointsHistory).toHaveBeenCalledWith({ limit: 20, offset: 20 });
  });

  it("shows empty state when history fails to load", async () => {
    getPointsHistory.mockRejectedValueOnce(new Error("Boom"));

    render(<PointsHistory />);

    await waitFor(() => expect(screen.getByText("No points history yet")).toBeInTheDocument());
  });
});
