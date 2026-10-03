import React from "react";

export type BadgeVariant =
  | "planned"
  | "completed"
  | "strength"
  | "agility"
  | "endurance"
  | "explosivity"
  | "intelligence"
  | "regeneration"
  | "success"
  | "info"
  | "warning"
  | "danger";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
}

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    padding: "0.25rem 0.5rem",
    fontSize: "var(--font-size-xs)",
  },
  md: {
    padding: "0.375rem 0.75rem",
    fontSize: "var(--font-size-sm)",
  },
  lg: {
    padding: "0.5rem 1rem",
    fontSize: "var(--font-size-md)",
  },
};

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-lg)",
  fontWeight: "var(--font-weight-semibold)",
  letterSpacing: "var(--type-metric-small-letter-spacing)",
  whiteSpace: "nowrap",
  boxShadow: "var(--shadow-e1)",
};

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  planned: {
    background: "linear-gradient(90deg, var(--color-focus), var(--vibe-intelligence))",
    color: "var(--color-on-color)",
  },
  completed: {
    background: "var(--color-completed)",
    color: "var(--color-on-color)",
  },
  strength: {
    background: "rgba(251, 149, 29, 0.2)",
    color: "var(--vibe-strength)",
    border: `1px solid rgba(251, 149, 29, 0.3)`,
  },
  agility: {
    background: "rgba(250, 233, 25, 0.2)",
    color: "var(--vibe-agility)",
    border: `1px solid rgba(250, 233, 25, 0.3)`,
  },
  endurance: {
    background: "rgba(0, 35, 34, 0.2)",
    color: "var(--vibe-endurance)",
    border: `1px solid rgba(0, 35, 34, 0.3)`,
  },
  explosivity: {
    background: "rgba(159, 36, 6, 0.2)",
    color: "var(--vibe-explosivity)",
    border: `1px solid rgba(159, 36, 6, 0.3)`,
  },
  intelligence: {
    background: "rgba(0, 24, 23, 0.2)",
    color: "var(--vibe-intelligence)",
    border: `1px solid rgba(0, 24, 23, 0.3)`,
  },
  regeneration: {
    background: "rgba(21, 82, 58, 0.2)",
    color: "var(--vibe-regeneration)",
    border: `1px solid rgba(21, 82, 58, 0.3)`,
  },
  success: {
    background: "var(--color-success-bg)",
    color: "var(--color-success-text)",
    border: `1px solid var(--color-success-border)`,
  },
  info: {
    background: "var(--color-info-bg)",
    color: "var(--color-info-text)",
    border: `1px solid var(--color-info-border)`,
  },
  warning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning-text)",
    border: `1px solid var(--color-warning-border)`,
  },
  danger: {
    background: "var(--color-danger-bg)",
    color: "var(--color-danger-text)",
    border: `1px solid var(--color-danger-border)`,
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "info",
  size = "md",
  children,
  className,
  style,
  ...props
}) => {
  const computedStyle: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <span className={className} style={computedStyle} {...props}>
      {children}
    </span>
  );
};
