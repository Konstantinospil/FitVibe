import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { InputControl, type FieldControlSize, type FieldControlVariant } from "@fitvibe/ui";

export type InputSize = FieldControlSize;
export type InputVariant = FieldControlVariant;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: InputSize;
  variant?: InputVariant;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      size = "md",
      variant = "default",
      className,
      id,
      required,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex--column flex--gap-xs" style={{ width: "100%" }}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm"
            style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
          >
            {label}
            {required && (
              <span
                className="text-danger-text"
                style={{ marginLeft: "var(--space-xs)" }}
                aria-label={t("validation.required")}
              >
                *
              </span>
            )}
          </label>
        )}
        <InputControl
          ref={ref}
          id={inputId}
          className={className}
          controlSize={size}
          variant={error ? "error" : variant}
          style={style}
          disabled={disabled}
          required={required}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
          aria-errormessage={errorId}
          aria-required={required}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="text-sm text-danger-text"
            style={{ margin: 0 }}
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm"
            style={{ margin: 0, color: "var(--color-text-muted)" }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
