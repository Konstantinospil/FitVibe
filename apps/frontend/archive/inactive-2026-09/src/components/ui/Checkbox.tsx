import React, { forwardRef } from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

const checkboxStyle: React.CSSProperties = {
  width: "20px",
  height: "20px",
  cursor: "pointer",
  accentColor: "var(--color-primary)",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-sm)",
  cursor: "pointer",
  color: "var(--color-text-primary)",
  fontSize: "var(--font-size-md)",
};

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
};

/**
 * Checkbox component with label, error, and helper text support.
 * Provides consistent styling and accessibility attributes.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, helperText, className, id, disabled, style, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = error ? `${checkboxId}-error` : undefined;
    const helperId = helperText ? `${checkboxId}-helper` : undefined;

    const computedCheckboxStyle: React.CSSProperties = {
      ...checkboxStyle,
      ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
      ...style,
    };

    const computedLabelStyle: React.CSSProperties = {
      ...labelStyle,
      ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
    };

    return (
      <div className={className} style={containerStyle}>
        <label htmlFor={checkboxId} style={computedLabelStyle}>
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            style={computedCheckboxStyle}
            disabled={disabled}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
            aria-errormessage={errorId}
            {...props}
          />
          {label && <span>{label}</span>}
        </label>
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="text-sm text-danger-text"
            style={{ margin: 0, marginLeft: "calc(20px + var(--space-sm))" }}
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm"
            style={{
              margin: 0,
              marginLeft: "calc(20px + var(--space-sm))",
              color: "var(--color-text-muted)",
            }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
