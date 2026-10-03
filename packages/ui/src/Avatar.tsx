import React, { useMemo } from "react";

export type AvatarSize = "sm" | "lg";
export type AvatarFormat = "initials" | "photo";
export type AvatarStatus = "online" | "offline" | "unknown";
export type AvatarStatusDisplay = "auto" | "embedded" | "dot";

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  src?: string;
  size?: AvatarSize;
  format?: AvatarFormat;
  status?: AvatarStatus;
  statusDisplay?: AvatarStatusDisplay;
}

const dimensions: Record<AvatarSize, { size: string; fontSize: string; dot: string }> = {
  sm: {
    size: "48px",
    fontSize: "var(--type-section-title-size)",
    dot: "10px",
  },
  lg: {
    size: "96px",
    fontSize: "var(--type-display-size)",
    dot: "18px",
  },
};

const statusColors: Record<Exclude<AvatarStatus, "unknown">, string> = {
  online: "var(--color-success-text)",
  offline: "var(--color-danger-text)",
};

const getInitials = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }

  return words
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = "sm",
  format,
  status = "unknown",
  statusDisplay = "auto",
  style,
  ...rest
}) => {
  const initials = useMemo(() => getInitials(name), [name]);
  const resolvedFormat: AvatarFormat = format ?? (src ? "photo" : "initials");
  const resolvedStatusDisplay: Exclude<AvatarStatusDisplay, "auto"> =
    statusDisplay === "auto" ? (size === "lg" ? "dot" : "embedded") : statusDisplay;

  const metrics = dimensions[size];
  const statusColor = status === "unknown" ? null : statusColors[status];

  const embeddedBackground =
    resolvedFormat === "initials" && statusColor ? statusColor : "var(--color-surface)";
  const embeddedTextColor =
    resolvedFormat === "initials" && statusColor
      ? "var(--color-secondary-on)"
      : "var(--color-text-primary)";
  const hasEmbeddedStatusRing = resolvedFormat === "photo" && Boolean(statusColor);
  const embeddedBorderWidth = hasEmbeddedStatusRing ? "3px" : "1px";
  const embeddedBorderColor = statusColor && hasEmbeddedStatusRing ? statusColor : "var(--color-border)";

  return (
    <div
      data-component="avatar"
      data-size={size}
      data-format={resolvedFormat}
      data-status={status}
      data-status-display={resolvedStatusDisplay}
      aria-label={status === "unknown" ? name : `${name}, ${status}`}
      style={{
        position: "relative",
        width: metrics.size,
        height: metrics.size,
        flex: "none",
        ...style,
      }}
      {...rest}
    >
      <div
        data-slot="avatar-surface"
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: "var(--radius-full)",
          background:
            resolvedStatusDisplay === "embedded" ? embeddedBackground : "var(--color-surface)",
          borderWidth:
            resolvedStatusDisplay === "embedded" ? embeddedBorderWidth : "1px",
          borderStyle: "solid",
          borderColor:
            resolvedStatusDisplay === "embedded"
              ? embeddedBorderColor
              : "var(--color-border)",
          display: "grid",
          placeItems: "center",
          color:
            resolvedStatusDisplay === "embedded"
              ? embeddedTextColor
              : "var(--color-text-primary)",
          fontFamily: "var(--font-family-body)",
          fontWeight: "var(--font-weight-regular)",
          fontSize: metrics.fontSize,
          lineHeight: "var(--type-display-line-height)",
          letterSpacing: "var(--type-control-letter-spacing)",
          textTransform: "uppercase",
        }}
      >
        {resolvedFormat === "photo" && src ? (
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
          <span data-slot="initials">{initials}</span>
        )}
      </div>

      {resolvedStatusDisplay === "dot" && statusColor ? (
        <span
          data-slot="status-dot"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "calc(var(--space-xs) * -1)",
            bottom: "calc(var(--space-xs) * -1)",
            width: metrics.dot,
            height: metrics.dot,
            borderRadius: "var(--radius-full)",
            background: statusColor,
            border: "2px solid var(--color-surface)",
            boxShadow: "var(--shadow-e1)",
          }}
        />
      ) : null}
    </div>
  );
};

Avatar.displayName = "Avatar";
