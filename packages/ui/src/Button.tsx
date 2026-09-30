import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
};

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-xs)",
  borderRadius: "var(--radius-md)",
  border: "none",
  fontWeight: "var(--font-weight-semibold)",
  letterSpacing: "var(--type-metric-small-letter-spacing)",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  transition: "transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease",
  boxShadow: "var(--button-shadow, none)",
  position: "relative",
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "0.5rem 1.1rem", fontSize: "var(--font-size-sm)" },
  md: { padding: "0.9rem 1.4rem", fontSize: "var(--font-size-md)" },
  lg: { padding: "1.1rem 1.6rem", fontSize: "var(--font-size-lg)" },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "var(--color-primary)", color: "var(--color-primary-on)" },
  secondary: {
    background: "var(--color-surface)",
    color: "var(--color-secondary)",
    border: "1px solid var(--color-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid transparent",
    boxShadow: "none",
  },
  danger: { background: "var(--color-danger)", color: "var(--color-primary-on)" },
};

const disabledStyle: React.CSSProperties = {
  opacity: "var(--opacity-disabled)",
  cursor: "not-allowed",
  boxShadow: "none",
};

const iconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--type-body-size)",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      style,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const computedStyle: React.CSSProperties = {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth ? { width: "100%" } : {}),
      ...(disabled || isLoading ? disabledStyle : {}),
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-label={
          isLoading && typeof children === "string" && !rest["aria-label"] ? children : undefined
        }
        data-variant={variant}
        data-size={size}
        style={computedStyle}
        {...rest}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
          >
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "var(--radius-full)",
                border: "2px solid var(--border-subtle)",
                borderTopColor: "var(--color-text-secondary)",
                animation: "button-spin 0.6s linear infinite",
              }}
            />
          </span>
        ) : null}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            visibility: isLoading ? "hidden" : "visible",
          }}
        >
          {leftIcon ? <span style={iconStyle}>{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span style={iconStyle}>{rightIcon}</span> : null}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
