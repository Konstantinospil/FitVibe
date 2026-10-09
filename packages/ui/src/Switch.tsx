import React, { forwardRef, useId, useState } from "react";
export type SwitchState = "inactive" | "active" | "hover" | "disabled";
export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "style" | "className"
> {
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
      ...props
    },
    ref,
  ) => {
    const generatedId = useId(),
      switchId = id ?? generatedId,
      helperId = helperText ? `${switchId}-helper` : undefined;
    const [hovered, setHovered] = useState(false),
      [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
    const controlled = checked !== undefined,
      isChecked = controlled ? Boolean(checked) : uncontrolledChecked;
    const state: SwitchState = disabled
      ? "disabled"
      : hovered
        ? "hover"
        : isChecked
          ? "active"
          : "inactive";
    return (
      <div
        className={className}
        data-component="switch"
        data-state={state}
        data-checked={isChecked || undefined}
        style={style}
      >
        <label
          htmlFor={switchId}
          onMouseEnter={() => !disabled && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span aria-hidden="true" data-slot="switch-track">
            <span data-slot="switch-thumb" />
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
            onChange={(e) => {
              if (!controlled) {
                setUncontrolledChecked(e.target.checked);
              }
              props.onChange?.(e);
            }}
          />
          {label ? <span>{label}</span> : null}
        </label>
        {helperText ? (
          <span id={helperId} data-slot="helper">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);
Switch.displayName = "Switch";
