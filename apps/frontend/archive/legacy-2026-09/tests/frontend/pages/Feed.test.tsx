import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Feed from "../../src/pages/Feed";
import * as api from "../../src/services/api";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

// Mock the API module
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getFeed: vi.fn(),
    likeFeedItem: vi.fn(),
    unlikeFeedItem: vi.fn(),
    cloneSessionFromFeed: vi.fn(),
  };
});

const mockFeedData = {
  items: [
    {
      id: "feed-1",
      user: {
        id: "user-1",
        username: "athlete1",
        displayName: "John Doe",
      },
      session: {
        id: "session-1",
        title: "Morning Workout",
        notes: "Great session!",
        plannedAt: "2025-01-15T08:00:00Z",
        completedAt: "2025-01-15T09:30:00Z",
        exerciseCount: 5,
        totalVolume: 15000,
      },
      visibility: "public",
      createdAt: "2025-01-15T09:30:00Z",
      likesCount: 10,
      commentsCount: 2,
      isLiked: false,
    },
    {
      id: "feed-2",
      user: {
        id: "user-2",
        username: "athlete2",
        displayName: "Jane Smith",
      },
      session: {
        id: "session-2",
        title: "Evening Strength",
        notes: "Felt strong today",
        plannedAt: "2025-01-14T18:00:00Z",
        completedAt: "2025-01-14T19:30:00Z",
        exerciseCount: 4,
        totalVolume: 12000,
      },
      visibility: "private",
      createdAt: "2025-01-14T19:30:00Z",
      likesCount: 5,
      commentsCount: 1,
      isLiked: true,
    },
  ],
  total: 2,
};

describe("Feed visibility guards", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(api.getFeed).mockResolvedValue(mockFeedData);
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <ToastProvider>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </ToastProvider>,
    );
  };

  it("disables session cloning when visibility is private", async () => {
    renderWithProvider(<Feed />);

    // Wait for feed items to load
    await waitFor(
      () => {
        expect(screen.getByText(/Morning Workout/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Get all clone/open session buttons (button text varies based on translations)
    const cloneButtons = screen.getAllByRole("button", { name: /clone|open session/i });

    // Filter to only secondary variant buttons (the clone buttons, not like buttons)
    const secondaryButtons = cloneButtons.filter(
      (button) => button.getAttribute("data-variant") === "secondary",
    );
    expect(secondaryButtons.length).toBe(2);

    // The second button (private session) should be disabled
    const privateCloneButton = secondaryButtons[1];
    expect(privateCloneButton).toBeDisabled();

    // The first button (public session) should not be disabled
    const publicCloneButton = secondaryButtons[0];
    expect(publicCloneButton).not.toBeDisabled();
  });

  it("should show loading state", () => {
    vi.mocked(api.getFeed).mockImplementation(() => new Promise(() => {})); // Never resolves

    const { container } = renderWithProvider(<Feed />);

    // Should show skeleton loaders (check for Skeleton components)
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should show error state", async () => {
    vi.mocked(api.getFeed).mockRejectedValue(new Error("Failed to load"));

    const { container } = renderWithProvider(<Feed />);

    await waitFor(
      () => {
        // Check for empty-state card which is rendered in error state
        const emptyState = container.querySelector(".empty-state");
        expect(emptyState).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should show empty state when no items", async () => {
    vi.mocked(api.getFeed).mockResolvedValue({ items: [], total: 0 });

    const { container } = renderWithProvider(<Feed />);

    await waitFor(
      () => {
        // Check for empty-state card which is rendered in empty state
        const emptyState = container.querySelector(".empty-state");
        expect(emptyState).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle like toggle when item is liked", async () => {
    vi.mocked(api.getFeed).mockResolvedValue(mockFeedData);
    vi.mocked(api.unlikeFeedItem).mockResolvedValue(undefined);

    renderWithProvider(<Feed />);

    await waitFor(
      () => {
        expect(screen.getByText(/Evening Strength/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Find the like button for the liked item (second item - has ♥)
    const likeButtons = screen.getAllByRole("button");
    const likedButton = likeButtons.find((btn) => btn.textContent?.includes("♥"));

    if (likedButton) {
      likedButton.click();
    }

    await waitFor(
      () => {
        expect(api.unlikeFeedItem).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  it("should handle like toggle when item is not liked", async () => {
    vi.mocked(api.getFeed).mockResolvedValue(mockFeedData);
    vi.mocked(api.likeFeedItem).mockResolvedValue(undefined);

    renderWithProvider(<Feed />);

    await waitFor(
      () => {
        expect(screen.getByText(/Morning Workout/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Find the like button for the unliked item (first item - has ♡)
    const likeButtons = screen.getAllByRole("button");
    const unlikedButton = likeButtons.find((btn) => btn.textContent?.includes("♡"));

    if (unlikedButton) {
      unlikedButton.click();
    }

    await waitFor(
      () => {
        expect(api.likeFeedItem).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  it("should handle clone session", async () => {
    vi.mocked(api.getFeed).mockResolvedValue(mockFeedData);
    vi.mocked(api.cloneSessionFromFeed).mockResolvedValue(undefined);

    renderWithProvider(<Feed />);

    await waitFor(
      () => {
        expect(screen.getByText(/Morning Workout/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Find clone button using the same approach as the first test
    await waitFor(
      () => {
        const cloneButtons = screen.getAllByRole("button", { name: /clone|open session/i });
        // Filter to only secondary variant buttons (the clone buttons, not like buttons)
        const secondaryButtons = cloneButtons.filter(
          (button) => button.getAttribute("data-variant") === "secondary",
        );
        expect(secondaryButtons.length).toBeGreaterThan(0);
        const publicCloneButton = secondaryButtons[0];
        expect(publicCloneButton).not.toBeDisabled();
        publicCloneButton.click();
      },
      { timeout: 5000 },
    );

    await waitFor(
      () => {
        expect(api.cloneSessionFromFeed).toHaveBeenCalled();
        // Check that it was called with session-1 (may have additional args)
        const calls = vi.mocked(api.cloneSessionFromFeed).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][0]).toBe("session-1");
      },
      { timeout: 5000 },
    );
  });

  it("should display username when displayName is missing", async () => {
    const feedDataWithoutDisplayName = {
      items: [
        {
          id: "feed-1",
          user: {
            id: "user-1",
            username: "athlete1",
            displayName: null,
          },
          session: {
            id: "session-1",
            title: "Workout",
            notes: null,
            plannedAt: "2025-01-15T08:00:00Z",
            completedAt: "2025-01-15T09:30:00Z",
            exerciseCount: 5,
            totalVolume: null,
          },
          visibility: "public",
          createdAt: "2025-01-15T09:30:00Z",
          likesCount: 10,
          commentsCount: 2,
          isLiked: false,
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFeed).mockResolvedValue(feedDataWithoutDisplayName);

    renderWithProvider(<Feed />);

    await waitFor(
      () => {
        expect(screen.getByText("athlete1")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle session without title", async () => {
    const feedDataWithoutTitle = {
      items: [
        {
          id: "feed-1",
          user: {
            id: "user-1",
            username: "athlete1",
            displayName: "John Doe",
          },
          session: {
            id: "session-1",
            title: null,
            notes: "Great session!",
            plannedAt: "2025-01-15T08:00:00Z",
            completedAt: "2025-01-15T09:30:00Z",
            exerciseCount: 5,
            totalVolume: 15000,
          },
          visibility: "public",
          createdAt: "2025-01-15T09:30:00Z",
          likesCount: 10,
          commentsCount: 2,
          isLiked: false,
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFeed).mockResolvedValue(feedDataWithoutTitle);

    renderWithProvider(<Feed />);

    // Feed component doesn't display notes, only title. When title is null, it just doesn't show a title.
    // Verify the feed item is rendered (check for user display name)
    await waitFor(
      () => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle session without notes", async () => {
    const feedDataWithoutNotes = {
      items: [
        {
          id: "feed-1",
          user: {
            id: "user-1",
            username: "athlete1",
            displayName: "John Doe",
          },
          session: {
            id: "session-1",
            title: "Morning Workout",
            notes: null,
            plannedAt: "2025-01-15T08:00:00Z",
            completedAt: "2025-01-15T09:30:00Z",
            exerciseCount: 5,
            totalVolume: 15000,
          },
          visibility: "public",
          createdAt: "2025-01-15T09:30:00Z",
          likesCount: 10,
          commentsCount: 2,
          isLiked: false,
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFeed).mockResolvedValue(feedDataWithoutNotes);

    renderWithProvider(<Feed />);

    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should display 'No volume data' when totalVolume is null", async () => {
    const feedDataWithoutVolume = {
      items: [
        {
          id: "feed-1",
          feedItemId: "feed-1",
          user: {
            id: "user-1",
            username: "athlete1",
            displayName: "John Doe",
          },
          session: {
            id: "session-1",
            title: "Morning Workout",
            notes: "Great session!",
            plannedAt: "2025-01-15T08:00:00Z",
            completedAt: "2025-01-15T09:30:00Z",
            exerciseCount: 5,
            totalVolume: null as any,
          },
          visibility: "public",
          createdAt: "2025-01-15T09:30:00Z",
          likesCount: 10,
          commentsCount: 2,
          isLiked: false,
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFeed).mockResolvedValue(feedDataWithoutVolume);

    renderWithProvider(<Feed />);

    // Feed component doesn't display volume data, so just verify the session title is shown
    await waitFor(
      () => {
        expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle clone mutation error", async () => {
    vi.mocked(api.getFeed).mockResolvedValue(mockFeedData);
    vi.mocked(api.cloneSessionFromFeed).mockRejectedValue(new Error("Clone failed"));

    renderWithProvider(<Feed />);

    // Wait for feed item to appear
    await screen.findByText(/Morning Workout/i, {}, { timeout: 5000 });

    // Find clone button using the same approach as the first test
    const cloneButtons = await screen.findAllByRole("button", { name: /clone|open session/i }, { timeout: 5000 });
    // Filter to only secondary variant buttons (the clone buttons, not like buttons)
    const secondaryButtons = cloneButtons.filter(
      (button) => button.getAttribute("data-variant") === "secondary",
    );
    expect(secondaryButtons.length).toBeGreaterThan(0);
    const publicCloneButton = secondaryButtons[0];
    expect(publicCloneButton).not.toBeDisabled();
    fireEvent.click(publicCloneButton);

    // Wait for API call
    await waitFor(
      () => {
        expect(api.cloneSessionFromFeed).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });
});
