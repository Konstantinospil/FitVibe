import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { VibeformProfile } from "@fitvibe/types";
import { VIBE_KEYS, type VibeKey } from "../../constants/vibes";
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

/**
 * Reading (and tab) order of the slots around the figure, top-left to bottom-right.
 * Positions come from the stylesheet per data-vibe; a Record makes every Vibe need one.
 */
const READING_POSITION: Record<VibeKey, number> = {
  regeneration: 0,
  intelligence: 1,
  agility: 2,
  endurance: 3,
  strength: 4,
  explosivity: 5,
};

const SLOT_ORDER = [...VIBE_KEYS].sort((a, b) => READING_POSITION[a] - READING_POSITION[b]);

export function VibeformConstellation({
  profile,
  labels,
  levels,
  selectedVibe = null,
  onVibeSelect,
  className,
  accessibleLabel,
  vibeformAccessibleLabel,
}: VibeformConstellationProps) {
  const { t } = useTranslation();
  const rootClassName = ["vibeform-constellation", className].filter(Boolean).join(" ");

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={accessibleLabel ?? t("dashboard.vibeformTitle")}
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
          accessibleLabel={vibeformAccessibleLabel ?? t("dashboard.vibeformAccessibleLabel")}
          className="vibeform-constellation__renderer"
        />
      </div>

      {SLOT_ORDER.map((vibe) => (
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
