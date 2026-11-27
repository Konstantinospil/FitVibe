import React, { useState } from "react";
import { Button, type ButtonSize } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import type { VibeKey } from "../../constants/vibes";
import { VibeIcon } from "./VibeIcon";

export interface VibeBadgeProps {
  vibe: VibeKey;
  label: string;
  level?: React.ReactNode;
  size?: ButtonSize;
  disabled?: boolean;
}

export const VibeBadge: React.FC<VibeBadgeProps> = ({
  vibe,
  label,
  level,
  size = "lg",
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [showLevel, setShowLevel] = useState(false);
  const canRevealLevel = level !== undefined && level !== null;
  const accessibleLevel =
    typeof level === "string" || typeof level === "number" ? String(level) : t("vibeBadge.level");

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={disabled}
      aria-label={
        canRevealLevel
          ? showLevel
            ? t("vibeBadge.showIcon", { label, level: accessibleLevel })
            : t("vibeBadge.showLevel", { label })
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
        <polygon data-slot="vibe-frame-shape" points="50,3 93,25 93,75 50,97 7,75 7,25" />
      </svg>

      {showLevel && canRevealLevel ? (
        <span data-slot="vibe-level">{level}</span>
      ) : (
        <VibeIcon vibe={vibe} />
      )}
    </Button>
  );
};

VibeBadge.displayName = "VibeBadge";
