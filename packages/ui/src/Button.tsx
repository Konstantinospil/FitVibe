import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonState = "active" | "disabled" | "loading";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** @deprecated Use leadingIcon. */ leftIcon?: React.ReactNode;
  /** @deprecated Use trailingIcon. */ rightIcon?: React.ReactNode;
  fullWidth?: boolean;
};
export const BUTTON_SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { minHeight: "var(--control-height-sm)" },
  md: { minHeight: "var(--control-height-md)" },
  lg: { minHeight: "var(--control-height-lg)" },
};
export const BUTTON_ICON_SIZES: Record<ButtonSize, string> = {
  sm: "var(--control-icon-sm)",
  md: "var(--control-icon-md)",
  lg: "var(--control-icon-lg)",
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
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled);
    const state: ButtonState = isLoading ? "loading" : isDisabled ? "disabled" : "active";
    const resolvedLeadingIcon = isLoading ? null : (leadingIcon ?? leftIcon);
    const resolvedTrailingIcon = isLoading ? null : (trailingIcon ?? rightIcon);
    return (
      <button
        ref={ref}
        disabled={isDisabled || isLoading}
        aria-disabled={isDisabled || isLoading}
        aria-busy={isLoading}
        data-ui="button"
        data-component="button"
        data-variant={variant}
        data-size={size}
        data-state={state}
        data-full-width={fullWidth || undefined}
        style={style}
        {...rest}
      >
        <span data-slot="content">
          {isLoading ? (
            <span aria-hidden="true" data-testid="button-spinner" data-slot="spinner" />
          ) : resolvedLeadingIcon ? (
            <span aria-hidden="true" data-slot="leading-icon">
              {resolvedLeadingIcon}
            </span>
          ) : null}
          <span>{children}</span>
          {resolvedTrailingIcon ? (
            <span aria-hidden="true" data-slot="trailing-icon">
              {resolvedTrailingIcon}
            </span>
          ) : null}
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";
