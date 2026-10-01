import type { ReactNode } from "react";
import type { VibeformProfile } from "@fitvibe/types";
import type { VibeKey } from "../../constants/vibes";
import { VibeformRenderer } from "../../lib/vibeform";
import { VibeBadge } from "./VibeBadge";
import "./VibeformConstellation.css";

export type VibeformConstellationLabels = Record<VibeKey, string>;
export type VibeformConstellationLevels = Partial<Record<VibeKey, ReactNode>>;

export interface VibeformConstellationProps {
  profile: VibeformProfile;
  labels: VibeformConstellationLabels;
  levels?: VibeformConstellationLevels;
  selectedVibe?: VibeKey | null;
  onVibeSelect?: (vibe: VibeKey) => void;
  className?: string;
  accessibleLabel?: string;
  vibeformAccessibleLabel?: string;
}

const VIBE_ORDER: readonly VibeKey[] = [
  "regeneration",
  "intelligence",
  "agility",
  "endurance",
  "strength",
  "explosivity",
];

export function VibeformConstellation({
  profile,
  labels,
  levels,
  selectedVibe = null,
  onVibeSelect,
  className,
  accessibleLabel = "Vibeform dashboard",
  vibeformAccessibleLabel = "Athlete Vibeform",
}: VibeformConstellationProps) {
  const rootClassName = ["vibeform-constellation", className].filter(Boolean).join(" ");

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={accessibleLabel}
      data-component="vibeform-constellation"
    >
      <svg
        className="vibeform-constellation__frame"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <polygon
          className="vibeform-constellation__frame-surface"
          points="50,2 94,25 94,75 50,98 6,75 6,25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="vibeform-constellation__center">
        <VibeformRenderer
          profile={profile}
          accessibleLabel={vibeformAccessibleLabel}
          className="vibeform-constellation__renderer"
        />
      </div>

      {VIBE_ORDER.map((vibe) => (
        <div
          key={vibe}
          className="vibeform-constellation__slot"
          data-component="vibeform-constellation-slot"
          data-vibe={vibe}
          data-selected={selectedVibe === vibe || undefined}
          onClickCapture={() => onVibeSelect?.(vibe)}
        >
          <VibeBadge vibe={vibe} label={labels[vibe]} level={levels?.[vibe]} size="lg" />
        </div>
      ))}
    </div>
  );
}

VibeformConstellation.displayName = "VibeformConstellation";
