import React, { forwardRef, useId, useState } from "react";

export type CheckboxState = "inactive" | "active" | "hover" | "error" | "disabled";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "style" | "className"> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id,
      label,
      helperText,
      error,
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
    const checkboxId = id ?? generatedId;
    const helperId = helperText && !error ? `${checkboxId}-helper` : undefined;
    const errorId = error ? `${checkboxId}-error` : undefined;
    const [hovered, setHovered] = useState(false);
    const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? Boolean(checked) : uncontrolledChecked;

    const state: CheckboxState = disabled
      ? "disabled"
      : error
        ? "error"
        : hovered
          ? "hover"
          : isChecked
            ? "active"
            : "inactive";

    const borderColor =
      state === "error"
        ? "var(--color-danger-border)"
        : state === "hover"
          ? "var(--color-secondary-hover)"
          : "var(--color-secondary)";

    const fillColor =
      state === "error"
        ? "var(--color-danger)"
        : state === "hover"
          ? "var(--color-secondary-hover)"
          : "var(--color-secondary)";

    return (
      <div
        className={className}
        data-component="checkbox"
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
          htmlFor={checkboxId}
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
            alignItems: "flex-start",
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
            data-slot="checkbox-box"
            style={{
              width: "24px",
              height: "24px",
              flex: "none",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-sm)",
              border: `2px solid ${borderColor}`,
              background: isChecked ? fillColor : "var(--color-surface)",
              color: "var(--color-secondary-on)",
              transition:
                "background 150ms ease, border-color 150ms ease, color 150ms ease",
            }}
          >
            {isChecked ? (
              <svg
                data-slot="checkbox-check"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8.5 6.2 11.5 13 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>

          <input
            {...props}
            ref={ref}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            aria-errormessage={errorId}
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

        {error ? (
          <span
            id={errorId}
            role="alert"
            style={{
              marginLeft: "calc(24px + var(--space-sm))",
              color: "var(--color-danger-text)",
              fontFamily: "var(--font-family-body)",
              fontSize: "var(--type-supporting-size)",
              lineHeight: "var(--type-supporting-line-height)",
            }}
          >
            {error}
          </span>
        ) : helperText ? (
          <span
            id={helperId}
            style={{
              marginLeft: "calc(24px + var(--space-sm))",
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

Checkbox.displayName = "Checkbox";
