import React from "react";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
  wrap?: boolean;
}

const gapStyles: Record<"xs" | "sm" | "md" | "lg" | "xl", string> = {
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
};

/**
 * Stack component for flexible vertical or horizontal layouts.
 * Provides consistent spacing and alignment options.
 */
export const Stack: React.FC<StackProps> = ({
  children,
  direction = "column",
  gap = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  className,
  style,
  ...props
}) => {
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: direction,
    gap: gapStyles[gap],
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : "nowrap",
    ...style,
  };

  return (
    <div className={className} style={stackStyle} {...props}>
      {children}
    </div>
  );
};
