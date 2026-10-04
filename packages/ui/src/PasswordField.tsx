import React, { forwardRef, useId, useState } from "react";
import { IconButton } from "./IconButton";
import { InputControl } from "./FieldControls";

export type PasswordFieldState = "default" | "focus" | "error" | "disabled";

export interface PasswordFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "size" | "style" | "className" | "disabled" | "aria-invalid"
  > {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

const VisibilityIcon: React.FC<{ visible: boolean }> = ({ visible }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M2.5 10s2.8-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.8 4.5-7.5 4.5S2.5 10 2.5 10Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    {!visible ? (
      <path
        d="m3.5 3.5 13 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ) : null}
  </svg>
);

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      id,
      label,
      helperText,
      error = false,
      disabled = false,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(false);

    const reveal = () => {
      if (!disabled) {
        setVisible(true);
      }
    };
    const mask = () => setVisible(false);

    const state: PasswordFieldState = disabled
      ? "disabled"
      : error
        ? "error"
        : focused
          ? "focus"
          : "default";

    const borderColor =
      state === "focus"
        ? "var(--color-highlight)"
        : state === "error"
          ? "var(--color-danger-border)"
          : "var(--color-input-border)";

    return (
      <div
        data-component="password-field"
        data-state={state}
        data-visible={visible ? "true" : "false"}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: "var(--space-xs)",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
        }}
      >
        <label
          htmlFor={inputId}
          style={{
            width: "100%",
            minHeight: "20px",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontWeight: "var(--font-weight-regular)",
            fontSize: "var(--type-control-size)",
            lineHeight: "var(--type-control-line-height)",
            letterSpacing: "var(--type-control-letter-spacing)",
            textAlign: "center",
          }}
        >
          {label}
        </label>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            width: "100%",
          }}
        >
          <InputControl
            {...props}
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            disabled={disabled}
            variant={error ? "error" : "default"}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={helperId}
            style={{
              height: "38px",
              minHeight: "38px",
              padding:
                "var(--space-xs) calc(var(--space-xl) + var(--space-lg)) var(--space-xs) var(--space-md)",
              borderRadius: "var(--radius-md)",
              borderColor,
              background:
                state === "disabled" ? "var(--color-surface-muted)" : "var(--color-input-bg)",
              color: "var(--color-text-secondary)",
              opacity: "var(--opacity-full)",
            }}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
          />

          <IconButton
            type="button"
            variant="ghost"
            icon={<VisibilityIcon visible={visible} />}
            label={visible ? hidePasswordLabel : showPasswordLabel}
            disabled={disabled}
            title={visible ? hidePasswordLabel : showPasswordLabel}
            data-slot="password-visibility-toggle"
            onMouseDown={(event) => {
              event.preventDefault();
              reveal();
            }}
            onMouseUp={mask}
            onMouseLeave={mask}
            onTouchStart={reveal}
            onTouchEnd={mask}
            onTouchCancel={mask}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                reveal();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                mask();
              }
            }}
            onBlur={mask}
            style={{
              position: "absolute",
              right: "var(--space-xs)",
              borderRadius: "var(--radius-md)",
              color:
                state === "error" ? "var(--color-danger-text)" : "var(--color-text-secondary)",
            }}
          />
        </div>

        {helperText ? (
          <div
            id={helperId}
            style={{
              width: "100%",
              minHeight: "24px",
              color: error ? "var(--color-danger-text)" : "var(--color-text-secondary)",
              fontFamily: "var(--font-family-body)",
              fontWeight: "var(--font-weight-control-large)",
              fontSize: "var(--type-control-large-size)",
              lineHeight: "var(--type-control-large-line-height)",
              letterSpacing: "var(--type-control-large-letter-spacing)",
            }}
          >
            {helperText}
          </div>
        ) : null}
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";
