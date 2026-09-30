import React, { forwardRef, useState } from "react";
import {
  BUTTON_ICON_SIZES,
  BUTTON_SIZE_STYLES,
  type ButtonSize,
} from "./Button";

export type IconButtonVariant = "ghost" | "surface" | "danger";
export type IconButtonState = "active" | "hover" | "disabled";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: ButtonSize;
  href?: string;
  target?: string;
  rel?: string;
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

export const IconButton = forwardRef<HTMLElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = "ghost",
      size = "lg",
      disabled = false,
      href,
      target,
      rel,
      style,
      onMouseEnter,
      onMouseLeave,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false);
    const state: IconButtonState = disabled ? "disabled" : hovered ? "hover" : "active";
    const variantStyle = state === "hover" ? hoverStyles[variant] : activeStyles[variant];
    const controlSize = BUTTON_SIZE_STYLES[size].minHeight;

    const sharedProps = {
      "aria-label": label,
      "aria-disabled": disabled || undefined,
      title: props.title ?? label,
      "data-component": "icon-button",
      "data-variant": variant,
      "data-size": size,
      "data-state": state,
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        if (!disabled) setHovered(true);
        onMouseEnter?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
      },
      onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
        setHovered(false);
        onMouseLeave?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
      },
      style: {
        width: controlSize,
        height: controlSize,
        minWidth: controlSize,
        minHeight: controlSize,
        padding: "var(--space-xs)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid transparent",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        textDecoration: "none",
        transition:
          "background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease",
        opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
        ...variantStyle,
        ...style,
      } satisfies React.CSSProperties,
    };

    const content = (
      <span
        aria-hidden="true"
        data-slot="icon"
        style={{
          width: BUTTON_ICON_SIZES[size],
          height: BUTTON_ICON_SIZES[size],
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {icon}
      </span>
    );

    if (href) {
      return (
        <a
          {...sharedProps}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={disabled ? undefined : href}
          target={target}
          rel={rel}
          tabIndex={disabled ? -1 : props.tabIndex}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
          }}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        {...props}
        {...sharedProps}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={props.type ?? "button"}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
