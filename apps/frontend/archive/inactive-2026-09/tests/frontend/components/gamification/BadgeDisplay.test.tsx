import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeDisplay } from "../../src/components/gamification/BadgeDisplay";

const getUserBadges = vi.fn();
const getBadgeCatalog = vi.fn();

vi.mock("../../src/services/api", () => ({
  getUserBadges: (...args: unknown[]) => getUserBadges(...args),
  getBadgeCatalog: (...args: unknown[]) => getBadgeCatalog(...args),
}));

describe("BadgeDisplay", () => {
  beforeEach(() => {
    getUserBadges.mockReset();
    getBadgeCatalog.mockReset();
  });

  it("renders earned badges from the API", async () => {
    getUserBadges.mockResolvedValue({
      badges: [
        {
          id: "1",
          code: "first",
          name: "First",
          description: "Start",
          earnedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "2",
          code: "streak",
          name: "Streak",
          description: "7 days",
        },
      ],
      total: 2,
    });

    render(<BadgeDisplay />);

    await waitFor(() => expect(screen.getByText("First")).toBeInTheDocument());
    expect(screen.getByText("Streak")).toBeInTheDocument();
    expect(screen.getByText("Badges")).toBeInTheDocument();
  });

  it("shows empty state when the user has no badges", async () => {
    getUserBadges.mockResolvedValue({ badges: [], total: 0 });

    render(<BadgeDisplay showCatalog={false} />);

    await waitFor(() => expect(screen.getByText("No badges earned yet")).toBeInTheDocument());
  });

  it("loads catalog badges, handles an empty catalog, and swallows catalog errors", async () => {
    getUserBadges.mockResolvedValue({ badges: [], total: 0 });
    getBadgeCatalog.mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce({
      badges: [],
    });
    const { rerender } = render(<BadgeDisplay />);
    fireEvent.click(await screen.findByRole("tab", { name: /catalog/i }));
    await waitFor(() => expect(getBadgeCatalog).toHaveBeenCalled());
    expect(await screen.findByText("No badges in the catalog")).toBeInTheDocument();

    getBadgeCatalog.mockResolvedValue({
      badges: [{ id: "c1", code: "cat", name: "Catalog Badge", description: "All" }],
    });
    rerender(<BadgeDisplay />);
  });

  it("renders catalog badges and forwards clicks", async () => {
    getUserBadges.mockResolvedValue({ badges: [], total: 0 });
    getBadgeCatalog.mockResolvedValue({
      badges: [{ id: "c1", code: "cat", name: "Catalog Badge", description: "All" }],
    });
    const onBadgeClick = vi.fn();
    render(<BadgeDisplay onBadgeClick={onBadgeClick} />);
    fireEvent.click(await screen.findByRole("tab", { name: /catalog/i }));
    expect(await screen.findByText("Catalog Badge")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Catalog Badge"));
    expect(onBadgeClick).toHaveBeenCalled();
  });
});
