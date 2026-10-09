import React, { forwardRef } from "react";
import type { ButtonSize } from "./Button";
export type IconButtonVariant = "ghost" | "surface" | "danger";
export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: React.ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: ButtonSize;
  href?: string;
  target?: string;
  rel?: string;
}
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
      onClick,
      ...props
    },
    ref,
  ) => {
    const shared = {
      "aria-label": label,
      "aria-disabled": disabled || undefined,
      title: props.title ?? label,
      "data-component": "icon-button",
      "data-variant": variant,
      "data-size": size,
      style,
    };
    const content = (
      <span aria-hidden="true" data-slot="icon">
        {icon}
      </span>
    );
    if (href) {
      return (
        <a
          {...shared}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={disabled ? undefined : href}
          target={target}
          rel={rel}
          tabIndex={disabled ? -1 : props.tabIndex}
          onClick={(e) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
          }}
        >
          {content}
        </a>
      );
    }
    return (
      <button
        {...props}
        {...shared}
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
