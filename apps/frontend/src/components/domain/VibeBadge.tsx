import React, { useState } from "react";
import { Button, type ButtonSize } from "@fitvibe/ui";
import type { VibeKey } from "../../constants/vibes";
import strengthIcon from "../../assets/icons/earth-strength.svg";
import agilityIcon from "../../assets/icons/air-agility.svg";
import enduranceIcon from "../../assets/icons/water-endurance.svg";
import explosivityIcon from "../../assets/icons/fire-explosivity.svg";
import intelligenceIcon from "../../assets/icons/shadow-intelligence.svg";
import regenerationIcon from "../../assets/icons/aether-regeneration.svg";

export interface VibeBadgeProps {
  vibe: VibeKey;
  label: string;
  level?: React.ReactNode;
  size?: ButtonSize;
  disabled?: boolean;
}

const iconByVibe: Record<VibeKey, string> = {
  strength: strengthIcon,
  agility: agilityIcon,
  endurance: enduranceIcon,
  explosivity: explosivityIcon,
  intelligence: intelligenceIcon,
  regeneration: regenerationIcon,
};

export const VibeBadge: React.FC<VibeBadgeProps> = ({
  vibe,
  label,
  level,
  size = "lg",
  disabled = false,
}) => {
  const [showLevel, setShowLevel] = useState(false);
  const canRevealLevel = level !== undefined && level !== null;
  const accessibleLevel =
    typeof level === "string" || typeof level === "number" ? String(level) : "level";

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={disabled}
      aria-label={
        canRevealLevel
          ? showLevel
            ? `${label}: ${accessibleLevel}. Show vibe icon`
            : `${label}. Show level`
          : label
      }
      aria-pressed={canRevealLevel ? showLevel : undefined}
      data-component="vibe-badge"
      data-vibe={vibe}
      data-content={showLevel ? "level" : "icon"}
      onClick={() => {
        if (canRevealLevel) {
          setShowLevel((current) => !current);
        }
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        data-slot="vibe-frame"
      >
        <polygon
          data-slot="vibe-frame-shape"
          points="50,3 93,25 93,75 50,97 7,75 7,25"
        />
      </svg>

      {showLevel && canRevealLevel ? (
        <span data-slot="vibe-level">{level}</span>
      ) : (
        <span
          aria-hidden="true"
          data-slot="vibe-icon"
          style={{
            WebkitMaskImage: `url(${iconByVibe[vibe]})`,
            maskImage: `url(${iconByVibe[vibe]})`,
          }}
        />
      )}
    </Button>
  );
};

VibeBadge.displayName = "VibeBadge";
