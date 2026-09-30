import React from "react";
import { Flame } from "lucide-react";
import { Badge } from "../ui/Badge";

export interface StreakDisplayProps {
  currentStreak: number;
  longestStreak?: number;
  unit?: "days" | "weeks" | "sessions";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

/**
 * StreakDisplay component displays training streak information.
 * Shows current streak with optional longest streak and icon.
 */
export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  currentStreak,
  longestStreak,
  unit = "days",
  size = "md",
  showIcon = true,
}) => {
  const sizeStyles: Record<"sm" | "md" | "lg", React.CSSProperties> = {
    sm: {
      fontSize: "var(--font-size-sm)",
      gap: "0.25rem",
    },
    md: {
      fontSize: "var(--font-size-md)",
      gap: "0.5rem",
    },
    lg: {
      fontSize: "var(--font-size-lg)",
      gap: "0.75rem",
    },
  };

  const iconSizes: Record<"sm" | "md" | "lg", number> = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div
      className="flex flex--align-center flex--gap-sm"
      style={{
        ...sizeStyles[size],
      }}
    >
      {showIcon && (
        <Flame
          size={iconSizes[size]}
          style={{
            color: "var(--vibe-explosivity)",
          }}
        />
      )}
      <div className="flex flex--column flex--gap-xs">
        <div className="flex flex--align-center flex--gap-sm">
          <strong style={{ fontSize: "inherit" }}>{currentStreak}</strong>
          <span className="text-secondary" style={{ fontSize: "0.9em" }}>
            {unit}
          </span>
        </div>
        {longestStreak && longestStreak > currentStreak && (
          <span className="text-sm text-secondary" style={{ fontSize: "0.85em" }}>
            Best: {longestStreak} {unit}
          </span>
        )}
      </div>
      {currentStreak > 0 && (
        <Badge variant="explosivity" size="sm">
          {currentStreak} 🔥
        </Badge>
      )}
    </div>
  );
};
