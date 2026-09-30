import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadgeCard } from "@/components/gamification/BadgeCard";
import type { Badge } from "@/services/api";

// Mock dependencies
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "gamification.badges.rarity.common": "Common",
        "gamification.badges.rarity.rare": "Rare",
        "gamification.badges.rarity.epic": "Epic",
        "gamification.badges.rarity.legendary": "Legendary",
        "gamification.badges.progress": "Progress",
        "gamification.badges.earned": "Earned",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("lucide-react", () => ({
  Award: ({ size, style }: { size: number; style?: React.CSSProperties }) => (
    <div data-testid="award-icon" data-size={size} style={style}>
      Award
    </div>
  ),
  Lock: ({ size, style }: { size: number; style?: React.CSSProperties }) => (
    <div data-testid="lock-icon" data-size={size} style={style}>
      Lock
    </div>
  ),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({
    children,
    onClick,
    style,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    style?: React.CSSProperties;
  }) => (
    <div data-testid="card" onClick={onClick} style={style}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({
    children,
    variant,
    size,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} data-size={size}>
      {children}
    </span>
  ),
}));

describe("BadgeCard", () => {
  const mockEarnedBadge: Badge = {
    id: "badge-1",
    code: "first_session",
    name: "First Session",
    description: "Complete your first workout session",
    iconUrl: "https://example.com/badge-icon.png",
    category: "achievements",
    rarity: "common",
    earnedAt: "2024-01-15T10:00:00Z",
    progress: 1,
    maxProgress: 1,
  };

  const mockUnearnedBadge: Badge = {
    id: "badge-2",
    code: "streak_7",
    name: "7 Day Streak",
    description: "Work out for 7 consecutive days",
    category: "streaks",
    rarity: "rare",
    progress: 3,
    maxProgress: 7,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render badge card with name and description", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    expect(screen.getByText("First Session")).toBeInTheDocument();
    expect(screen.getByText("Complete your first workout session")).toBeInTheDocument();
  });

  it("should render earned badge with full opacity", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ opacity: 1 });
  });

  it("should render unearned badge with reduced opacity", () => {
    render(<BadgeCard badge={mockUnearnedBadge} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ opacity: 0.6 });
  });

  it("should render badge icon when iconUrl is provided", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    const icon = screen.getByAltText("First Session");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("src", "https://example.com/badge-icon.png");
  });

  it("should render Award icon when iconUrl is not provided", () => {
    const badgeWithoutIcon: Badge = {
      ...mockEarnedBadge,
      iconUrl: undefined,
    };

    const { container } = render(<BadgeCard badge={badgeWithoutIcon} />);

    // Award icon should be rendered as SVG (lucide-react icons render as SVG)
    // Check that there's an SVG in the badge icon container
    const iconContainer = container.querySelector(
      'div[style*="width: 80px"][style*="height: 80px"]',
    );
    expect(iconContainer).toBeInTheDocument();
    const svg = iconContainer?.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Should not have an img tag
    expect(screen.queryByAltText("First Session")).not.toBeInTheDocument();
  });

  it("should render lock icon for unearned badge", () => {
    const { container } = render(<BadgeCard badge={mockUnearnedBadge} />);

    // Lock icon should be rendered (check for SVG element which is how lucide-react renders icons)
    // The lock icon is inside a div with absolute positioning
    const lockContainer = container.querySelector('div[style*="position: absolute"]');
    expect(lockContainer).toBeInTheDocument();
    // Check that there's an SVG inside (lucide-react icons render as SVG)
    const svg = lockContainer?.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should not render lock icon for earned badge", () => {
    const { container } = render(<BadgeCard badge={mockEarnedBadge} />);

    // Lock icon container should not be present for earned badges
    const lockContainer = container.querySelector(
      'div[style*="position: absolute"][style*="background: rgba(0, 0, 0, 0.7)"]',
    );
    expect(lockContainer).not.toBeInTheDocument();
  });

  it("should render rarity badge when rarity is provided", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    const rarityBadge = screen.getByTestId("badge");
    expect(rarityBadge).toBeInTheDocument();
    expect(rarityBadge).toHaveTextContent("Common");
  });

  it("should not render rarity badge when rarity is not provided", () => {
    const badgeWithoutRarity: Badge = {
      ...mockEarnedBadge,
      rarity: undefined,
    };

    render(<BadgeCard badge={badgeWithoutRarity} />);

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("should render progress bar for unearned badge when showProgress is true", () => {
    render(<BadgeCard badge={mockUnearnedBadge} showProgress={true} />);

    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("3 / 7")).toBeInTheDocument();
  });

  it("should not render progress bar when showProgress is false", () => {
    render(<BadgeCard badge={mockUnearnedBadge} showProgress={false} />);

    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("3 / 7")).not.toBeInTheDocument();
  });

  it("should not render progress bar for earned badge", () => {
    render(<BadgeCard badge={mockEarnedBadge} showProgress={true} />);

    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("should not render progress bar when progress is undefined", () => {
    const badgeWithoutProgress: Badge = {
      ...mockUnearnedBadge,
      progress: undefined,
    };

    render(<BadgeCard badge={badgeWithoutProgress} showProgress={true} />);

    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("should calculate progress percentage correctly", () => {
    const { container } = render(<BadgeCard badge={mockUnearnedBadge} showProgress={true} />);

    // Progress should be 3/7 = ~42.86%, capped at 100%
    // Find the progress bar div (the inner div with width style)
    const progressBar = container.querySelector('div[style*="width: 42.857142857142854%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("should cap progress at 100%", () => {
    const badgeWithOverflow: Badge = {
      ...mockUnearnedBadge,
      progress: 10,
      maxProgress: 7,
    };

    const { container } = render(<BadgeCard badge={badgeWithOverflow} showProgress={true} />);

    // Find the progress bar div with 100% width
    const progressBar = container.querySelector('div[style*="width: 100%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("should render earned date for earned badge", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    expect(screen.getByText(/Earned/)).toBeInTheDocument();
    // Check that the date is rendered (format may vary by locale)
    const earnedText = screen.getByText(/Earned/);
    expect(earnedText.textContent).toContain("Earned");
  });

  it("should not render earned date for unearned badge", () => {
    render(<BadgeCard badge={mockUnearnedBadge} />);

    expect(screen.queryByText(/Earned/)).not.toBeInTheDocument();
  });

  it("should call onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<BadgeCard badge={mockEarnedBadge} onClick={onClick} />);

    const card = screen.getByTestId("card");
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should have pointer cursor when onClick is provided", () => {
    const onClick = vi.fn();
    render(<BadgeCard badge={mockEarnedBadge} onClick={onClick} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "pointer" });
  });

  it("should have default cursor when onClick is not provided", () => {
    render(<BadgeCard badge={mockEarnedBadge} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "default" });
  });

  it("should render different rarity types", () => {
    const rarities: Array<"common" | "rare" | "epic" | "legendary"> = [
      "common",
      "rare",
      "epic",
      "legendary",
    ];

    rarities.forEach((rarity) => {
      const { unmount } = render(<BadgeCard badge={{ ...mockEarnedBadge, rarity }} />);

      expect(screen.getByTestId("badge")).toBeInTheDocument();
      unmount();
    });
  });

  it("should handle badge with zero progress", () => {
    const badgeWithZeroProgress: Badge = {
      ...mockUnearnedBadge,
      progress: 0,
      maxProgress: 7,
    };

    const { container } = render(<BadgeCard badge={badgeWithZeroProgress} showProgress={true} />);

    expect(screen.getByText("0 / 7")).toBeInTheDocument();
    const progressBar = container.querySelector('div[style*="width: 0%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("should handle badge with maxProgress of 0", () => {
    const badgeWithZeroMax: Badge = {
      ...mockUnearnedBadge,
      progress: 3,
      maxProgress: 0,
    };

    const { container } = render(<BadgeCard badge={badgeWithZeroMax} showProgress={true} />);

    expect(screen.getByText("3 / 0")).toBeInTheDocument();
    const progressBar = container.querySelector('div[style*="width: 0%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("should handle badge without maxProgress", () => {
    const badgeWithoutMax: Badge = {
      ...mockUnearnedBadge,
      maxProgress: undefined,
    };

    render(<BadgeCard badge={badgeWithoutMax} showProgress={true} />);

    expect(screen.getByText("3 / 0")).toBeInTheDocument();
  });

  it("should default showProgress to true", () => {
    render(<BadgeCard badge={mockUnearnedBadge} />);

    expect(screen.getByText("Progress")).toBeInTheDocument();
  });
});
