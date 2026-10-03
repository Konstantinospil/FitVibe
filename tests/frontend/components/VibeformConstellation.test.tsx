import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VibeformProfile } from "@fitvibe/types";
import {
  VibeformConstellation,
  type VibeformConstellationLabels,
} from "../../../apps/frontend/src/components/domain/VibeformConstellation";

const profile: VibeformProfile = {
  preferences: {
    templateCode: "flow",
    templateVersion: 1,
    bodyProfile: "balanced",
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
    lowerBodyLoad: 0.7,
    bmi: 23,
    heightCm: 178,
  },
  calculationVersion: "2",
  calculatedAt: "2026-10-01T18:00:00.000Z",
};

const labels: VibeformConstellationLabels = {
  strength: "Strength",
  agility: "Agility",
  endurance: "Endurance",
  explosivity: "Explosivity",
  intelligence: "Intelligence",
  regeneration: "Regeneration",
};

describe("VibeformConstellation", () => {
  it("composes the persisted Vibeform with all six reusable Vibe controls", () => {
    const { container } = render(<VibeformConstellation profile={profile} labels={labels} />);

    expect(container.querySelector("[data-component='vibeform-constellation']")).toBeInTheDocument();
    expect(
      container.querySelectorAll("[data-component='vibeform-constellation-slot']"),
    ).toHaveLength(6);
    expect(container.querySelector("[data-vibeform-template='flow']")).toBeInTheDocument();

    Object.values(labels).forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("reports Vibe selection to its parent without owning dashboard state", () => {
    const onVibeSelect = vi.fn();

    const { container } = render(
      <VibeformConstellation
        profile={profile}
        labels={labels}
        selectedVibe="endurance"
        onVibeSelect={onVibeSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Strength" }));

    expect(onVibeSelect).toHaveBeenCalledWith("strength");
    expect(
      container.querySelector(
        "[data-component='vibeform-constellation-slot'][data-vibe='endurance'][data-selected='true']",
      ),
    ).toBeInTheDocument();
  });

  it("passes backend-supported levels through to the existing VibeBadge contract", () => {
    render(
      <VibeformConstellation profile={profile} labels={labels} levels={{ strength: "Level 4" }} />,
    );

    const strength = screen.getByRole("button", { name: "Strength. Show level" });
    fireEvent.click(strength);

    expect(screen.getByText("Level 4")).toBeInTheDocument();
  });
});
