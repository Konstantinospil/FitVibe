import React, { useMemo } from "react";

export type AvatarStatus = "online" | "offline" | "busy" | "away";

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  src?: string;
  size?: number;
  status?: AvatarStatus;
}

const statusColors: Record<AvatarStatus, string> = {
  online: "var(--color-accent)",
  offline: "var(--color-text-muted)",
  busy: "var(--color-danger)",
  away: "var(--color-warning)",
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("") || value.slice(0, 2).toUpperCase();

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 48, status, style, ...rest }) => {
  const initials = useMemo(() => getInitials(name), [name]);

  const dimension = `${size}px`;
  const fontSize = `${Math.max(12, Math.floor(size * 0.42))}px`;

  return (
    <div
      aria-label={name}
      style={{
        position: "relative",
        width: dimension,
        height: dimension,
        borderRadius: "var(--radius-full)",
        overflow: "hidden",
        background: "linear-gradient(135deg, var(--border-success-subtle), var(--border-focus-subtle))",
        border: "1px solid var(--color-border)",
        display: "grid",
        placeItems: "center",
        fontWeight: "var(--font-weight-semibold)",
        color: "var(--color-text-primary)",
        letterSpacing: "var(--type-metric-small-letter-spacing)",
        textTransform: "uppercase",
        fontSize,
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
      {status ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "4px",
            right: "4px",
            width: "10px",
            height: "10px",
            borderRadius: "var(--radius-full)",
            background: statusColors[status],
            border: "2px solid var(--color-bg-card)",
            boxShadow: "0 0 0 2px var(--surface-muted-subtle)",
          }}
        />
      ) : null}
    </div>
  );
};
