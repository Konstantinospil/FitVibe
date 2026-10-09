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
const getInitials = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
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
  return (
    <div
      data-component="avatar"
      data-size={size}
      data-format={resolvedFormat}
      data-status={status}
      data-status-display={resolvedStatusDisplay}
      aria-label={status === "unknown" ? name : `${name}, ${status}`}
      style={style}
      {...rest}
    >
      <div data-slot="avatar-surface">
        {resolvedFormat === "photo" && src ? (
          <img src={src} alt={name} loading="lazy" data-slot="avatar-image" />
        ) : (
          <span data-slot="initials">{initials}</span>
        )}
      </div>
      {resolvedStatusDisplay === "dot" && status !== "unknown" ? (
        <span data-slot="status-dot" aria-hidden="true" />
      ) : null}
    </div>
  );
};
Avatar.displayName = "Avatar";
