import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VibeformProfile } from "@fitvibe/types";
import { apiClient } from "../../../apps/frontend/src/services/api";
import {
  adaptVibeformProfile,
  getMyVibeformProfile,
  NEUTRAL_VIBEFORM_BMI,
  NEUTRAL_VIBEFORM_HEIGHT_CM,
  updateMyVibeformPreferences,
  VibeformRenderer,
} from "../../../apps/frontend/src/lib/vibeform";

const profile: VibeformProfile = {
  preferences: {
    templateCode: "flow",
    templateVersion: 1,
    bodyProfile: "shoulder-dominant",
    motionEnabled: false,
  },
  metrics: {
    intelligence: 0.4,
    regeneration: 0.5,
    agility: 0.6,
    explosivity: 0.7,
    endurance: 0.8,
    strength: 0.9,
    upperBodyLoad: 0.75,
    lowerBodyLoad: 0.25,
    bmi: null,
    heightCm: null,
  },
  calculationVersion: "2",
  calculatedAt: "2026-09-19T20:00:00.000Z",
};

afterEach(() => vi.restoreAllMocks());

describe("Vibeform API", () => {
  it("loads the authenticated user's profile from the versioned endpoint", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });

    await expect(getMyVibeformProfile()).resolves.toEqual(profile);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/vibeforms/me");
  });

  it.each([
    ["absent response", undefined],
    ["missing preferences", { metrics: profile.metrics }],
    ["missing metrics", { preferences: profile.preferences }],
    ["missing metric value", { ...profile, metrics: { ...profile.metrics, strength: undefined } }],
  ])("rejects %s rather than rendering an invalid profile", async (_name, body) => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: body });
    await expect(getMyVibeformProfile()).rejects.toThrow("Invalid Vibeform profile response");
  });
  it("updates preferences without sending calculated metrics", async () => {
    vi.spyOn(apiClient, "put").mockResolvedValue({ data: profile.preferences });

    await updateMyVibeformPreferences({ motionEnabled: false });
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/vibeforms/me/preferences", {
      motionEnabled: false,
    });
  });
});

describe("Vibeform rendering boundary", () => {
  it("uses neutral display defaults for nullable measurements", () => {
    expect(adaptVibeformProfile(profile)).toMatchObject({
      bmi: NEUTRAL_VIBEFORM_BMI,
      heightCm: NEUTRAL_VIBEFORM_HEIGHT_CM,
      bodyProfile: "shoulder-dominant",
      upperBodyLoad: 0.75,
      lowerBodyLoad: 0.25,
    });
  });

  it("renders the selected template with the profile preferences", () => {
    const { container } = render(<VibeformRenderer profile={profile} accessibleLabel="Athlete" />);
    const boundary = container.querySelector("[data-vibeform-version]");
    const svg = screen.getByRole("img", { name: "Athlete" });

    expect(boundary).toHaveAttribute("data-vibeform-version", "1");
    expect(svg).toHaveAttribute("data-vibeform-template", "flow");
    expect(svg).toHaveAttribute("data-motion-enabled", "false");
    expect(svg.querySelector("g")).not.toHaveClass("vibeform-pulse");
    expect(svg.querySelector("style")).toHaveTextContent("prefers-reduced-motion");
  });

  it("enables the flow animation only when the profile opts into motion", () => {
    const animatedProfile = {
      ...profile,
      preferences: { ...profile.preferences, motionEnabled: true },
    };

    const { container } = render(<VibeformRenderer profile={animatedProfile} />);
    const svg = container.querySelector('[data-vibeform-template="flow"]');

    expect(svg).toHaveAttribute("data-motion-enabled", "true");
    expect(svg?.querySelector("g")).toHaveClass("vibeform-pulse");
  });

  it("falls back safely when a stale profile names an unavailable template", () => {
    const staleProfile = {
      ...profile,
      preferences: { ...profile.preferences, templateCode: "retired-template" },
    } as unknown as VibeformProfile;

    const { container } = render(<VibeformRenderer profile={staleProfile} />);

    expect(container.querySelector('[data-vibeform-template-fallback="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-vibeform-template="flow"]')).toBeInTheDocument();
  });

  it("clamps malformed API scores without interpreting another backend scale", () => {
    const malformed = {
      ...profile,
      metrics: { ...profile.metrics, intelligence: 100, agility: -4 },
    };

    expect(adaptVibeformProfile(malformed)).toMatchObject({ intelligence: 1, agility: 0 });
  });
});
