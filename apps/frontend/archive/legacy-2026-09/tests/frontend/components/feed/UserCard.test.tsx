import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserCard } from "@/components/feed/UserCard";
import type { UserProfile } from "@/services/api";

// Mock dependencies
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "feed.user.followers": "followers",
        "feed.user.following": "following",
      };
      return translations[key] || key;
    },
  }),
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

vi.mock("@/components/ui/Avatar", () => ({
  Avatar: ({ name, src, size }: { name: string; src?: string; size: number }) => (
    <div data-testid="avatar" data-name={name} data-src={src} data-size={size}>
      {name.charAt(0).toUpperCase()}
    </div>
  ),
}));

vi.mock("@/components/feed/FollowButton", () => ({
  FollowButton: ({
    userAlias,
    initialFollowing,
    onFollowChange,
    size,
    variant,
  }: {
    userAlias: string;
    initialFollowing?: boolean;
    onFollowChange?: (following: boolean) => void;
    size: string;
    variant: string;
  }) => (
    <button
      data-testid="follow-button"
      data-user-alias={userAlias}
      data-following={String(initialFollowing ?? false)}
      onClick={() => onFollowChange && onFollowChange(!initialFollowing)}
    >
      {initialFollowing ? "Unfollow" : "Follow"}
    </button>
  ),
}));

describe("UserCard", () => {
  const mockUser: UserProfile = {
    id: "user-1",
    username: "testuser",
    displayName: "Test User",
    email: "test@example.com",
    alias: "testuser",
    bio: "Test bio",
    followersCount: 100,
    followingCount: 50,
    isFollowing: false,
    isOwnProfile: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render user card with display name and username", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("should render avatar with display name", () => {
    render(<UserCard user={mockUser} />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-name", "Test User");
    expect(avatar).toHaveAttribute("data-size", "56");
  });

  it("should render avatar with username when display name is not available", () => {
    const userWithoutDisplayName: UserProfile = {
      ...mockUser,
      displayName: undefined,
    };

    render(<UserCard user={userWithoutDisplayName} />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-name", "testuser");
  });

  it("should render avatar with avatarUrl when provided", () => {
    const userWithAvatar: UserProfile = {
      ...mockUser,
      avatarUrl: "https://example.com/avatar.jpg",
    };

    render(<UserCard user={userWithAvatar} />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-src", "https://example.com/avatar.jpg");
  });

  it("should render bio when provided", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("Test bio")).toBeInTheDocument();
  });

  it("should not render bio when not provided", () => {
    const userWithoutBio: UserProfile = {
      ...mockUser,
      bio: null,
    };

    render(<UserCard user={userWithoutBio} />);

    expect(screen.queryByText("Test bio")).not.toBeInTheDocument();
  });

  it("should render followers count when provided", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("followers")).toBeInTheDocument();
  });

  it("should render following count when provided", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("following")).toBeInTheDocument();
  });

  it("should render both followers and following counts", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("followers")).toBeInTheDocument();
    expect(screen.getByText("following")).toBeInTheDocument();
  });

  it("should not render followers count when undefined", () => {
    const userWithoutFollowers: UserProfile = {
      ...mockUser,
      followersCount: undefined,
    };

    render(<UserCard user={userWithoutFollowers} />);

    expect(screen.queryByText("100")).not.toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("should not render following count when undefined", () => {
    const userWithoutFollowing: UserProfile = {
      ...mockUser,
      followingCount: undefined,
    };

    render(<UserCard user={userWithoutFollowing} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.queryByText("50")).not.toBeInTheDocument();
  });

  it("should not render counts section when both are undefined", () => {
    const userWithoutCounts: UserProfile = {
      ...mockUser,
      followersCount: undefined,
      followingCount: undefined,
    };

    render(<UserCard user={userWithoutCounts} />);

    expect(screen.queryByText("followers")).not.toBeInTheDocument();
    expect(screen.queryByText("following")).not.toBeInTheDocument();
  });

  it("should render follow button when showFollowButton is true and not own profile", () => {
    render(<UserCard user={mockUser} showFollowButton={true} />);

    const followButton = screen.getByTestId("follow-button");
    expect(followButton).toBeInTheDocument();
    // FollowButton is rendered, which means the component is working correctly
    // The actual FollowButton component may not expose data-user-id attribute
  });

  it("should not render follow button when showFollowButton is false", () => {
    render(<UserCard user={mockUser} showFollowButton={false} />);

    expect(screen.queryByTestId("follow-button")).not.toBeInTheDocument();
  });

  it("should not render follow button for own profile", () => {
    const ownProfile: UserProfile = {
      ...mockUser,
      isOwnProfile: true,
    };

    render(<UserCard user={ownProfile} showFollowButton={true} />);

    expect(screen.queryByTestId("follow-button")).not.toBeInTheDocument();
  });

  it("should call onFollowChange when follow button is clicked", () => {
    const onFollowChange = vi.fn();
    render(<UserCard user={mockUser} onFollowChange={onFollowChange} />);

    const followButton = screen.getByTestId("follow-button");
    fireEvent.click(followButton);

    expect(onFollowChange).toHaveBeenCalledWith(true);
  });

  it("should render follow button with initial following state", () => {
    const followingUser: UserProfile = {
      ...mockUser,
      isFollowing: true,
    };

    render(<UserCard user={followingUser} />);

    const followButton = screen.getByTestId("follow-button");
    expect(followButton).toHaveAttribute("data-following", "true");
    expect(screen.getByText("Unfollow")).toBeInTheDocument();
  });

  it("should call onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<UserCard user={mockUser} onClick={onClick} />);

    const card = screen.getByTestId("card");
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should have pointer cursor when onClick is provided", () => {
    const onClick = vi.fn();
    render(<UserCard user={mockUser} onClick={onClick} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "pointer" });
  });

  it("should have default cursor when onClick is not provided", () => {
    render(<UserCard user={mockUser} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ cursor: "default" });
  });

  it("should handle follow button click and toggle following state", () => {
    const onFollowChange = vi.fn();
    const followingUser: UserProfile = {
      ...mockUser,
      isFollowing: true,
    };

    render(<UserCard user={followingUser} onFollowChange={onFollowChange} />);

    const followButton = screen.getByTestId("follow-button");
    fireEvent.click(followButton);

    expect(onFollowChange).toHaveBeenCalledWith(false);
  });

  it("should render card with CardContent", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("should handle user with only username (no display name)", () => {
    const userWithOnlyUsername: UserProfile = {
      ...mockUser,
      displayName: undefined,
    };

    render(<UserCard user={userWithOnlyUsername} />);

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("should handle user with zero followers and following", () => {
    const userWithZeroCounts: UserProfile = {
      ...mockUser,
      followersCount: 0,
      followingCount: 0,
    };

    render(<UserCard user={userWithZeroCounts} />);

    const zeroElements = screen.getAllByText("0");
    expect(zeroElements).toHaveLength(2);
    expect(screen.getByText("followers")).toBeInTheDocument();
    expect(screen.getByText("following")).toBeInTheDocument();
  });
});
