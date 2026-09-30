import React, { forwardRef, useState } from "react";

export type IconButtonVariant = "ghost" | "surface" | "danger";
export type IconButtonState = "active" | "hover" | "disabled";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  label: string;
  variant?: IconButtonVariant;
}

const activeStyles: Record<IconButtonVariant, React.CSSProperties> = {
  ghost: {
    background: "transparent",
    borderColor: "transparent",
    color: "var(--color-text-secondary)",
    boxShadow: "none",
  },
  surface: {
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
    color: "var(--color-text-secondary)",
    boxShadow: "var(--shadow-e1)",
  },
  danger: {
    background: "transparent",
    borderColor: "transparent",
    color: "var(--color-danger-text)",
    boxShadow: "none",
  },
};

const hoverStyles: Record<IconButtonVariant, React.CSSProperties> = {
  ghost: {
    background: "var(--color-surface-muted)",
    borderColor: "transparent",
    color: "var(--color-text-primary)",
    boxShadow: "none",
  },
  surface: {
    background: "var(--color-surface-muted)",
    borderColor: "var(--color-border-strong)",
    color: "var(--color-text-primary)",
    boxShadow: "var(--shadow-e1)",
  },
  danger: {
    background: "var(--surface-danger-subtle)",
    borderColor: "var(--border-danger-subtle)",
    color: "var(--color-danger-text)",
    boxShadow: "none",
  },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = "ghost",
      disabled = false,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false);

    const state: IconButtonState = disabled ? "disabled" : hovered ? "hover" : "active";
    const variantStyle = state === "hover" ? hoverStyles[variant] : activeStyles[variant];

    return (
      <button
        {...props}
        ref={ref}
        type={props.type ?? "button"}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={label}
        title={props.title ?? label}
        data-component="icon-button"
        data-variant={variant}
        data-state={state}
        onMouseEnter={(event) => {
          if (!disabled) setHovered(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        style={{
          width: "44px",
          height: "44px",
          minWidth: "44px",
          minHeight: "44px",
          padding: "var(--space-xs)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid transparent",
          borderRadius: "var(--radius-md)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition:
            "background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
          ...variantStyle,
          ...style,
        }}
      >
        <span
          aria-hidden="true"
          data-slot="icon"
          style={{
            width: "24px",
            height: "24px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {icon}
        </span>
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
