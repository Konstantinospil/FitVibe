import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../../src/pages/Dashboard";
import * as vibeApi from "../../src/lib/vibeform/api";
import * as api from "../../src/services/api";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { value?: number }) =>
    options?.value === undefined ? key : `${key}:${options.value}` }),
}));

vi.mock("../../src/lib/vibeform/api", () => ({ getMyVibeformProfile: vi.fn() }));
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return { ...actual, getUserBadges: vi.fn() };
});
vi.mock("../../src/lib/vibeform/components/VibeformRenderer", () => ({
  VibeformRenderer: ({ profile }: { profile: { preferences: { templateCode: string } } }) => (
    <div>vibeform:{profile.preferences.templateCode}</div>
  ),
}));

const profile = {
  preferences: {
    templateCode: "flow" as const,
    templateVersion: 1,
    bodyProfile: "balanced" as const,
    motionEnabled: true,
  },
  metrics: {
    intelligence: 0.4,
    regeneration: 0.5,
    agility: 0.6,
    explosivity: 0.7,
    endurance: 0.8,
    strength: 0.9,
    upperBodyLoad: 0.5,
    lowerBodyLoad: 0.5,
    bmi: null,
    heightCm: null,
  },
  calculationVersion: "v1",
  calculatedAt: "2026-10-04T00:00:00.000Z",
};

describe("Dashboard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(vibeApi.getMyVibeformProfile).mockResolvedValue(profile);
    vi.mocked(api.getUserBadges).mockResolvedValue({
      badges: [{ id: "b1", code: "first", name: "First badge", description: "Earned" }],
      total: 1,
    });
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderDashboard = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>,
    );

  it("renders the persisted Vibeform profile and earned badges", async () => {
    renderDashboard();
    expect(await screen.findByText("vibeform:flow")).toBeInTheDocument();
    expect(screen.getByText("First badge")).toBeInTheDocument();
  });

  it("selects Vibes without changing persisted preferences", async () => {
    renderDashboard();
    await screen.findByText("vibeform:flow");
    fireEvent.click(screen.getByRole("button", { name: "vibes.endurance.name" }));
    expect(screen.getByText("dashboard.vibeValue:80")).toBeInTheDocument();
    expect(vibeApi.getMyVibeformProfile).toHaveBeenCalledTimes(1);
  });

  it("exposes a non-scoring fitness-test entry point", async () => {
    renderDashboard();
    await screen.findByText("vibeform:flow");
    fireEvent.click(screen.getByRole("button", { name: "dashboard.fitnessTestAction" }));
    expect(screen.getByText("dashboard.fitnessTestPending")).toBeInTheDocument();
  });

  it("retries a failed Vibeform request", async () => {
    vi.mocked(vibeApi.getMyVibeformProfile)
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(profile);
    renderDashboard();
    const retry = await screen.findByRole("button", { name: "actions.retry" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("vibeform:flow")).toBeInTheDocument());
  });
});

export {};
