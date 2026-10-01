import React, { forwardRef, useState } from "react";

export type TextLinkState = "active" | "clicked" | "inactive";

export interface TextLinkProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  href?: string;
  to?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit" | "reset";
  inactive?: boolean;
  children: React.ReactNode;
}

export const TextLink = forwardRef<HTMLElement, TextLinkProps>(
  (
    {
      as: Component = "a",
      href,
      to,
      target,
      rel,
      inactive = false,
      children,
      style,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onTouchStart,
      onTouchEnd,
      onKeyDown,
      onKeyUp,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [pressed, setPressed] = useState(false);

    const state: TextLinkState = inactive ? "inactive" : pressed ? "clicked" : "active";

    const handleRelease = () => setPressed(false);

    return (
      <Component
        {...props}
        ref={ref}
        {...(Component === "a" ? { href } : { to })}
        target={target}
        rel={rel}
        aria-disabled={inactive || undefined}
        tabIndex={inactive ? -1 : props.tabIndex}
        data-component="text-link"
        data-state={state}
        onMouseDown={(event: React.MouseEvent<HTMLElement>) => {
          if (!inactive) setPressed(true);
          onMouseDown?.(event);
        }}
        onMouseUp={(event: React.MouseEvent<HTMLElement>) => {
          handleRelease();
          onMouseUp?.(event);
        }}
        onMouseLeave={(event: React.MouseEvent<HTMLElement>) => {
          handleRelease();
          onMouseLeave?.(event);
        }}
        onTouchStart={(event: React.TouchEvent<HTMLElement>) => {
          if (!inactive) setPressed(true);
          onTouchStart?.(event);
        }}
        onTouchEnd={(event: React.TouchEvent<HTMLElement>) => {
          handleRelease();
          onTouchEnd?.(event);
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
          if (!inactive && (event.key === "Enter" || event.key === " ")) {
            setPressed(true);
          }
          onKeyDown?.(event);
        }}
        onKeyUp={(event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            handleRelease();
          }
          onKeyUp?.(event);
        }}
        onClick={(event: React.MouseEvent<HTMLElement>) => {
          if (inactive) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          width: "fit-content",
          color:
            state === "clicked"
              ? "var(--color-text-primary)"
              : "var(--color-info-text)",
          fontFamily: "var(--font-family-body)",
          fontWeight: "var(--font-weight-regular)",
          fontSize: "var(--type-control-large-size)",
          lineHeight: "var(--type-control-large-line-height)",
          letterSpacing: "var(--type-control-large-letter-spacing)",
          textDecorationLine: "underline",
          textDecorationColor: "currentColor",
          textDecorationThickness: state === "clicked" ? "2px" : "1px",
          textUnderlineOffset: "var(--space-xs)",
          opacity: inactive ? "var(--opacity-disabled)" : "var(--opacity-full)",
          cursor: inactive ? "not-allowed" : "pointer",
          transition:
            "color 150ms ease, opacity 150ms ease, text-decoration-thickness 150ms ease",
          ...style,
        }}
      >
        {children}
      </Component>
    );
  },
);

TextLink.displayName = "TextLink";
