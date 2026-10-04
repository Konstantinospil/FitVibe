import React, { useState } from "react";
import { BUTTON_ICON_SIZES, BUTTON_SIZE_STYLES, Button, type ButtonSize } from "@fitvibe/ui";
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

const colorByVibe: Record<VibeKey, string> = {
  strength: "var(--vibe-strength)",
  agility: "var(--vibe-agility)",
  endurance: "var(--vibe-endurance)",
  explosivity: "var(--vibe-explosivity)",
  intelligence: "var(--vibe-intelligence)",
  regeneration: "var(--vibe-regeneration)",
};

const onColorByVibe: Record<VibeKey, string> = {
  strength: "var(--vibe-on-light)",
  agility: "var(--vibe-on-light)",
  endurance: "var(--vibe-on-dark)",
  explosivity: "var(--vibe-on-dark)",
  intelligence: "var(--vibe-on-dark)",
  regeneration: "var(--vibe-on-dark)",
};

export const VibeBadge: React.FC<VibeBadgeProps> = ({
  vibe,
  label,
  level,
  size = "lg",
  disabled = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const canRevealLevel = level !== undefined && level !== null;
  const accessibleLevel =
    typeof level === "string" || typeof level === "number" ? String(level) : "level";
  const vibeColor = colorByVibe[vibe];
  const controlSize = BUTTON_SIZE_STYLES[size].minHeight;
  const iconSize = BUTTON_ICON_SIZES[size];
  const visualState = hovered && !disabled ? "hover" : "default";
  const foreground = visualState === "hover" ? onColorByVibe[vibe] : vibeColor;

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
      data-state={visualState}
      data-content={showLevel ? "level" : "icon"}
      onClick={() => {
        if (canRevealLevel) {
          setShowLevel((current) => !current);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        position: "relative",
        width: controlSize,
        height: controlSize,
        minWidth: controlSize,
        minHeight: controlSize,
        padding: 0,
        borderRadius: "var(--radius-none)",
        background: "transparent",
        boxShadow: visualState === "hover" ? "var(--shadow-e2)" : "none",
        opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <polygon
          points="50,3 93,25 93,75 50,97 7,75 7,25"
          fill={visualState === "hover" ? vibeColor : "var(--color-surface)"}
          stroke={vibeColor}
          strokeWidth="6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showLevel && canRevealLevel ? (
        <span
          data-slot="vibe-level"
          style={{
            position: "relative",
            zIndex: 1,
            color: foreground,
            fontFamily: "var(--font-family-heading)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "var(--type-metric-small-size)",
            lineHeight: "var(--type-metric-small-line-height)",
            letterSpacing: "var(--type-metric-small-letter-spacing)",
          }}
        >
          {level}
        </span>
      ) : (
        <span
          aria-hidden="true"
          data-slot="vibe-icon"
          style={{
            position: "relative",
            zIndex: 1,
            width: iconSize,
            height: iconSize,
            background: foreground,
            WebkitMaskImage: `url(${iconByVibe[vibe]})`,
            maskImage: `url(${iconByVibe[vibe]})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
      )}
    </Button>
  );
};

VibeBadge.displayName = "VibeBadge";
