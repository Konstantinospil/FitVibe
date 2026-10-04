import React, { forwardRef, useId, useState } from "react";

export type SwitchState = "inactive" | "active" | "hover" | "disabled";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "style" | "className"> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      id,
      label,
      helperText,
      disabled = false,
      checked,
      defaultChecked,
      className,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const switchId = id ?? generatedId;
    const helperId = helperText ? `${switchId}-helper` : undefined;
    const [hovered, setHovered] = useState(false);
    const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? Boolean(checked) : uncontrolledChecked;

    const state: SwitchState = disabled
      ? "disabled"
      : hovered
        ? "hover"
        : isChecked
          ? "active"
          : "inactive";

    const trackColor = isChecked
      ? hovered
        ? "var(--color-secondary-hover)"
        : "var(--color-secondary)"
      : hovered
        ? "var(--color-border-strong)"
        : "var(--color-border)";

    return (
      <div
        className={className}
        data-component="switch"
        data-state={state}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
          ...style,
        }}
      >
        <label
          htmlFor={switchId}
          onMouseEnter={() => {
            if (!disabled) {
              setHovered(true);
            }
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            cursor: disabled ? "not-allowed" : "pointer",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontWeight: "var(--font-weight-regular)",
            fontSize: "var(--type-control-size)",
            lineHeight: "var(--type-control-line-height)",
            letterSpacing: "var(--type-control-letter-spacing)",
          }}
        >
          <span
            aria-hidden="true"
            data-slot="switch-track"
            style={{
              position: "relative",
              width: "48px",
              height: "24px",
              flex: "none",
              borderRadius: "var(--radius-full)",
              background: trackColor,
              transition: "background 150ms ease",
            }}
          >
            <span
              data-slot="switch-thumb"
              style={{
                position: "absolute",
                top: "3px",
                left: isChecked ? "27px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "var(--radius-full)",
                background: isChecked
                  ? "var(--color-secondary-on)"
                  : "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-e1)",
                transition: "left 150ms ease, background 150ms ease",
              }}
            />
          </span>

          <input
            {...props}
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            aria-checked={isChecked}
            aria-describedby={helperId}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onChange={(event) => {
              if (!isControlled) {
                setUncontrolledChecked(event.target.checked);
              }
              props.onChange?.(event);
            }}
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              clipPath: "inset(50%)",
              whiteSpace: "nowrap",
            }}
          />

          {label ? <span>{label}</span> : null}
        </label>

        {helperText ? (
          <span
            id={helperId}
            style={{
              marginLeft: "calc(48px + var(--space-sm))",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-family-body)",
              fontSize: "var(--type-supporting-size)",
              lineHeight: "var(--type-supporting-line-height)",
            }}
          >
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

Switch.displayName = "Switch";
