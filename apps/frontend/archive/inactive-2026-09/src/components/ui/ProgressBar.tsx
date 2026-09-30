import React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "danger";
}

/**
 * ProgressBar component displays a progress indicator.
 * Supports different sizes, variants, and optional label.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = false,
  size = "md",
  variant = "default",
  style,
  ...rest
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeStyles: Record<"sm" | "md" | "lg", React.CSSProperties> = {
    sm: { height: "4px" },
    md: { height: "8px" },
    lg: { height: "12px" },
  };

  const variantColors: Record<string, string> = {
    default: "var(--color-primary)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        ...style,
      }}
      {...rest}
    >
      {showLabel && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        style={{
          width: "100%",
          ...sizeStyles[size],
          background: "var(--color-bg-secondary)",
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: variantColors[variant],
            borderRadius: "var(--radius-full)",
            transition: "width 0.3s ease",
          }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${Math.round(percentage)}% complete`}
        />
      </div>
    </div>
  );
};
