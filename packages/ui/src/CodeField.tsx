import React, { forwardRef, useId, useMemo, useState } from "react";
import { InputControl } from "./FieldControls";

export type CodeFieldState = "default" | "focus" | "error" | "disabled";

export interface CodeFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "size" | "style" | "className" | "disabled" | "aria-invalid"
  > {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  digits?: number;
}

export const CodeField = forwardRef<HTMLInputElement, CodeFieldProps>(
  (
    {
      id,
      label,
      helperText,
      error,
      disabled = false,
      digits = 6,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const [focused, setFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""));
    const isControlled = value !== undefined;
    const currentValue = isControlled ? String(value ?? "") : internalValue;

    const state: CodeFieldState = disabled
      ? "disabled"
      : error
        ? "error"
        : focused
          ? "focus"
          : "default";

    const isTotpPresentation = useMemo(
      () => new RegExp(`^\\d{0,${digits}}$`).test(currentValue),
      [currentValue, digits],
    );

    const borderColor =
      state === "focus"
        ? "var(--color-highlight)"
        : state === "error"
          ? "var(--color-danger-border)"
          : "var(--color-input-border)";

    return (
      <div
        data-component="code-field"
        data-state={state}
        data-mode={isTotpPresentation ? "totp" : "backup"}
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
          }}
        >
          {label}
        </label>

        <div
          style={{
            position: "relative",
            minHeight: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-sm) var(--space-md)",
            border: `1px solid ${borderColor}`,
            borderRadius: "var(--radius-md)",
            background:
              state === "disabled" ? "var(--color-surface-muted)" : "var(--color-input-bg)",
          }}
        >
          {isTotpPresentation ? (
            <div
              aria-hidden="true"
              data-slot="code-slots"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${digits}, minmax(0, 1fr))`,
                gap: "var(--space-sm)",
                width: "100%",
              }}
            >
              {Array.from({ length: digits }, (_, index) => {
                const character = currentValue[index];
                return (
                  <span
                    key={index}
                    data-slot="code-digit"
                    data-filled={character ? "true" : "false"}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      minWidth: 0,
                      color: error
                        ? "var(--color-danger-text)"
                        : character
                          ? "var(--color-highlight)"
                          : "var(--color-text-muted)",
                      fontFamily: "var(--font-family-body)",
                      fontWeight: character
                        ? "var(--font-weight-semibold)"
                        : "var(--font-weight-regular)",
                      fontSize: "var(--type-control-large-size)",
                      lineHeight: "var(--type-control-large-line-height)",
                      letterSpacing: "var(--type-control-large-letter-spacing)",
                    }}
                  >
                    {character ?? "0"}
                  </span>
                );
              })}
            </div>
          ) : (
            <div
              aria-hidden="true"
              data-slot="backup-code-value"
              style={{
                width: "100%",
                color: error ? "var(--color-danger-text)" : "var(--color-text-secondary)",
                fontFamily: "var(--font-family-body)",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--type-control-large-size)",
                lineHeight: "var(--type-control-large-line-height)",
                letterSpacing: "var(--type-control-large-letter-spacing)",
                textAlign: "center",
              }}
            >
              {currentValue}
            </div>
          )}

          <InputControl
            {...props}
            id={inputId}
            ref={ref}
            value={isControlled ? value : undefined}
            defaultValue={isControlled ? undefined : defaultValue}
            disabled={disabled}
            inputMode={props.inputMode ?? "text"}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
            aria-errormessage={errorId}
            onChange={(event) => {
              if (!isControlled) {
                setInternalValue(event.target.value);
              }
              props.onChange?.(event);
            }}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "transparent",
              caretColor: "transparent",
              cursor: disabled ? "not-allowed" : "text",
            }}
          />
        </div>

        {error ? (
          <div
            id={errorId}
            role="alert"
            style={{
              minHeight: "24px",
              color: "var(--color-danger-text)",
              fontFamily: "var(--font-family-body)",
              fontWeight: "var(--font-weight-control-large)",
              fontSize: "var(--type-control-large-size)",
              lineHeight: "var(--type-control-large-line-height)",
              letterSpacing: "var(--type-control-large-letter-spacing)",
            }}
          >
            {error}
          </div>
        ) : helperText ? (
          <div
            id={helperId}
            style={{
              minHeight: "24px",
              color: "var(--color-text-secondary)",
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

CodeField.displayName = "CodeField";
