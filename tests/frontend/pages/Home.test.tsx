import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../../src/pages/Home";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getFeed: vi.fn(),
    listSessions: vi.fn(),
  };
});

const { apiErrorSpy } = vi.hoisted(() => ({
  apiErrorSpy: vi.fn(),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: apiErrorSpy },
}));

const mockedApi = {
  getFeed: vi.mocked(api.getFeed),
  listSessions: vi.mocked(api.listSessions),
};

const feedItem: api.FeedItem = {
  id: "feed-1",
  feedItemId: "feed-1",
  user: {
    id: "user-2",
    username: "athlete",
    displayName: "Athlete",
  },
  session: {
    id: "session-feed",
    title: "Tempo Strength",
    plannedAt: "2026-01-15T09:00:00.000Z",
    completedAt: "2026-01-15T10:00:00.000Z",
    exerciseCount: 3,
  },
  visibility: "public",
  createdAt: "2026-01-15T10:00:00.000Z",
  publishedAt: "2026-01-15T10:00:00.000Z",
  likesCount: 4,
  commentsCount: 2,
  isLiked: false,
  isBookmarked: false,
};

const sessions: api.SessionsListResponse = {
  data: [
    {
      id: "session-1",
      owner_id: "user-1",
      title: "Morning Strength",
      planned_at: "2026-01-14T09:00:00.000Z",
      status: "completed",
      visibility: "private",
      completed_at: "2026-01-14T10:00:00.000Z",
      points: 12,
      exercises: [
        {
          id: "session-ex-1",
          session_id: "session-1",
          exercise_id: "exercise-1",
          order_index: 0,
          sets: [],
        },
      ],
    },
  ],
  total: 1,
  limit: 12,
  offset: 0,
};

describe("Home", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockedApi.getFeed.mockResolvedValue({
      items: [feedItem],
      total: 1,
      limit: 12,
      offset: 0,
    });
    mockedApi.listSessions.mockResolvedValue(sessions);
    apiErrorSpy.mockClear();
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderHome = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>,
    );

  it("renders the production Home contract", async () => {
    renderHome();

    expect(screen.getByText("homeSurface.sections.recentActivity")).toBeInTheDocument();
    expect(screen.getByText("homeSurface.sections.trending")).toBeInTheDocument();
    expect(screen.getByText("homeSurface.sections.newsFeed")).toBeInTheDocument();
    expect(screen.getByText("homeSurface.sections.previousActivities")).toBeInTheDocument();

    expect(await screen.findAllByText("Tempo Strength")).not.toHaveLength(0);
    expect(await screen.findByText("Morning Strength")).toBeInTheDocument();

    expect(mockedApi.getFeed).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "public", sort: "date" }),
    );
    expect(mockedApi.getFeed).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "public", sort: "popularity" }),
    );
    expect(mockedApi.listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("shows API error states and logs them", async () => {
    mockedApi.getFeed.mockRejectedValue(new Error("feed failed"));
    mockedApi.listSessions.mockRejectedValue(new Error("sessions failed"));

    renderHome();

    expect(await screen.findByText("homeSurface.errors.news")).toBeInTheDocument();
    expect(await screen.findByText("homeSurface.errors.trending")).toBeInTheDocument();
    expect(await screen.findByText("homeSurface.errors.activities")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiErrorSpy).toHaveBeenCalledTimes(3);
    });
  });

  it("refetches a failed Home source from its retry action", async () => {
    mockedApi.getFeed.mockRejectedValueOnce(new Error("feed failed"));
    renderHome();

    const retryButtons = await screen.findAllByRole("button", { name: "actions.retry" });
    mockedApi.getFeed.mockResolvedValue({
      items: [feedItem],
      total: 1,
      limit: 12,
      offset: 0,
    });

    fireEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(mockedApi.getFeed.mock.calls.length).toBeGreaterThan(2);
    });
  });

  it("shows empty states without fabricating data", async () => {
    mockedApi.getFeed.mockResolvedValue({
      items: [],
      total: 0,
      limit: 12,
      offset: 0,
    });
    mockedApi.listSessions.mockResolvedValue({
      data: [],
      total: 0,
      limit: 12,
      offset: 0,
    });

    renderHome();

    expect(await screen.findByText("homeSurface.empty.news")).toBeInTheDocument();
    expect(await screen.findByText("homeSurface.empty.trending")).toBeInTheDocument();
    expect(await screen.findByText("homeSurface.empty.activities")).toBeInTheDocument();
  });
});
