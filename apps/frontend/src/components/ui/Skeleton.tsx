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
        "linear-gradient(90deg, var(--tone-slate-400-a15), var(--tone-slate-400-a35), var(--tone-slate-400-a15))",
      backgroundSize: "200px 100%",
      animation: "skeleton-shimmer 1.6s ease-in-out infinite",
      ...style,
    }}
    {...rest}
  />
);

export default Skeleton;
