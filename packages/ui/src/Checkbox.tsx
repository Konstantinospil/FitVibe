import React, { forwardRef, useId, useState } from "react";
export type CheckboxState = "inactive" | "active" | "hover" | "error" | "disabled";
export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "style" | "className"
> {
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
      ...props
    },
    ref,
  ) => {
    const generatedId = useId(),
      checkboxId = id ?? generatedId,
      helperId = helperText && !error ? `${checkboxId}-helper` : undefined,
      errorId = error ? `${checkboxId}-error` : undefined;
    const [hovered, setHovered] = useState(false),
      [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
    const controlled = checked !== undefined,
      isChecked = controlled ? Boolean(checked) : uncontrolledChecked;
    const state: CheckboxState = disabled
      ? "disabled"
      : error
        ? "error"
        : hovered
          ? "hover"
          : isChecked
            ? "active"
            : "inactive";
    return (
      <div
        className={className}
        data-component="checkbox"
        data-state={state}
        data-checked={isChecked || undefined}
        style={style}
      >
        <label
          htmlFor={checkboxId}
          onMouseEnter={() => !disabled && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span aria-hidden="true" data-slot="checkbox-box">
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
            aria-errormessage={errorId}
            onChange={(e) => {
              if (!controlled) {
                setUncontrolledChecked(e.target.checked);
              }
              props.onChange?.(e);
            }}
          />
          {label ? <span>{label}</span> : null}
        </label>
        {error ? (
          <span id={errorId} role="alert" data-slot="helper" data-tone="error">
            {error}
          </span>
        ) : helperText ? (
          <span id={helperId} data-slot="helper">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
