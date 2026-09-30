import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "1rem",
  radius = "12px",
  style,
  ...rest
}) => (
  <div
    aria-hidden="true"
    style={{
      width,
      height,
      borderRadius: radius,
      background:
        "linear-gradient(90deg, var(--border-subtle), var(--color-border-strong), var(--border-subtle))",
      backgroundSize: "200px 100%",
      animation: "skeleton-shimmer 1.6s ease-in-out infinite",
      ...style,
    }}
    {...rest}
  />
);

export default Skeleton;
