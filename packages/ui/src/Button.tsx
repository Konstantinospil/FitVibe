import React, { forwardRef, useState } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonState = "active" | "hover" | "disabled" | "loading";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** @deprecated Use leadingIcon. */
  leftIcon?: React.ReactNode;
  /** @deprecated Use trailingIcon. */
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
};

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-xs)",
  borderRadius: "var(--radius-md)",
  border: "1px solid transparent",
  fontFamily: "var(--font-family-body)",
  fontWeight: "var(--font-weight-regular)",
  letterSpacing: "var(--type-control-letter-spacing)",
  cursor: "pointer",
  transition:
    "background 150ms ease, color 150ms ease, border-color 150ms ease, opacity 150ms ease",
  boxShadow: "var(--button-shadow, none)",
  position: "relative",
  whiteSpace: "nowrap",
};

export const BUTTON_SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    minHeight: "34px",
    padding: "var(--space-xs) var(--space-sm)",
    fontSize: "var(--type-control-size)",
    lineHeight: "var(--type-control-line-height)",
  },
  md: {
    minHeight: "40px",
    padding: "var(--space-xs) var(--space-md)",
    fontSize: "var(--type-control-size)",
    lineHeight: "var(--type-control-line-height)",
  },
  lg: {
    minHeight: "48px",
    padding: "var(--space-sm) var(--space-lg)",
    fontSize: "var(--type-control-large-size)",
    lineHeight: "var(--type-control-large-line-height)",
    fontWeight: "var(--font-weight-control-large)",
  },
};

const activeVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-primary-on)",
  },
  secondary: {
    background: "var(--color-secondary)",
    color: "var(--color-secondary-on)",
  },
  danger: {
    background: "var(--color-danger)",
    color: "var(--color-primary-on)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderColor: "transparent",
    boxShadow: "none",
  },
};

const hoverVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-primary-hover)",
    color: "var(--color-primary-on)",
  },
  secondary: {
    background: "var(--color-secondary-hover)",
    color: "var(--color-secondary-on)",
  },
  danger: {
    background:
      "color-mix(in srgb, var(--color-danger) var(--transparency-subtle), var(--color-danger-text))",
    color: "var(--color-primary-on)",
  },
  ghost: {
    background: "var(--color-surface-muted)",
    color: "var(--color-text-primary)",
    borderColor: "transparent",
    boxShadow: "none",
  },
};

export const BUTTON_ICON_SIZES: Record<ButtonSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "20px",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leadingIcon,
      trailingIcon,
      leftIcon,
      rightIcon,
      fullWidth = false,
      style,
      disabled,
      onMouseEnter,
      onMouseLeave,
      ...rest
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false);
    const isDisabled = Boolean(disabled);
    const state: ButtonState = isLoading
      ? "loading"
      : isDisabled
        ? "disabled"
        : hovered
          ? "hover"
          : "active";

    const computedStyle: React.CSSProperties = {
      ...baseStyle,
      ...BUTTON_SIZE_STYLES[size],
      ...(state === "hover" ? hoverVariantStyles[variant] : activeVariantStyles[variant]),
      ...(fullWidth ? { width: "100%" } : {}),
      ...(state === "disabled"
        ? {
            opacity: "var(--opacity-disabled)",
            cursor: "not-allowed",
            boxShadow: "none",
          }
        : {}),
      ...style,
    };

    const resolvedLeadingIcon = isLoading ? null : (leadingIcon ?? leftIcon);
    const resolvedTrailingIcon = isLoading ? null : (trailingIcon ?? rightIcon);

    return (
      <button
        ref={ref}
        disabled={isDisabled || isLoading}
        aria-disabled={isDisabled || isLoading}
        aria-busy={isLoading}
        data-variant={variant}
        data-size={size}
        data-state={state}
        style={computedStyle}
        onMouseEnter={(event) => {
          if (!isDisabled && !isLoading) {
            setHovered(true);
          }
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        {...rest}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-xs)",
          }}
        >
          {isLoading ? (
            <span
              aria-hidden="true"
              data-testid="button-spinner"
              style={{
                width: BUTTON_ICON_SIZES[size],
                height: BUTTON_ICON_SIZES[size],
                flex: "none",
                borderRadius: "var(--radius-full)",
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                animation: "button-spin 0.6s linear infinite",
              }}
            />
          ) : resolvedLeadingIcon ? (
            <span
              aria-hidden="true"
              data-slot="leading-icon"
              style={{
                width: BUTTON_ICON_SIZES[size],
                height: BUTTON_ICON_SIZES[size],
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {resolvedLeadingIcon}
            </span>
          ) : null}

          <span>{children}</span>

          {resolvedTrailingIcon ? (
            <span
              aria-hidden="true"
              data-slot="trailing-icon"
              style={{
                width: BUTTON_ICON_SIZES[size],
                height: BUTTON_ICON_SIZES[size],
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {resolvedTrailingIcon}
            </span>
          ) : null}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
