import React from "react";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}

const gapStyles: Record<"xs" | "sm" | "md" | "lg" | "xl", string> = {
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
};

/**
 * Grid component for responsive grid layouts.
 * Supports responsive column counts and consistent gap spacing.
 */
export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  gap = "md",
  className,
  style,
  ...props
}) => {
  const getGridTemplateColumns = (): string => {
    if (typeof columns === "number") {
      return `repeat(${columns}, 1fr)`;
    }

    const sm = columns.sm || 1;
    const md = columns.md || sm;
    const lg = columns.lg || md;
    const xl = columns.xl || lg;

    return `repeat(${xl}, 1fr)`;
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: getGridTemplateColumns(),
    gap: gapStyles[gap],
    ...style,
  };

  return (
    <div className={className} style={gridStyle} {...props}>
      {children}
    </div>
  );
};
