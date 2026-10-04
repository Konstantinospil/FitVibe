import React, { forwardRef } from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

const switchContainerStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
  width: "44px",
  height: "24px",
  flexShrink: 0,
};

const switchInputStyle: React.CSSProperties = {
  opacity: 0,
  width: 0,
  height: 0,
};

const switchSliderStyle: React.CSSProperties = {
  position: "absolute",
  cursor: "pointer",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "var(--color-border)",
  transition: "150ms ease",
  borderRadius: "24px",
};

const switchSliderBeforeStyle: React.CSSProperties = {
  position: "absolute",
  content: '""',
  height: "18px",
  width: "18px",
  left: "3px",
  bottom: "3px",
  backgroundColor: "var(--color-text-primary)",
  transition: "150ms ease",
  borderRadius: "50%",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
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
 * Switch (toggle) component with label, error, and helper text support.
 * Provides consistent styling and accessibility attributes.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      id,
      disabled,
      checked,
      onChange,
      style: _style,
      ...props
    },
    ref,
  ) => {
    const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = error ? `${switchId}-error` : undefined;
    const helperId = helperText ? `${switchId}-helper` : undefined;

    const computedSliderStyle: React.CSSProperties = {
      ...switchSliderStyle,
      ...(checked ? { backgroundColor: "var(--color-primary)" } : {}),
      ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
    };

    const computedSliderBeforeStyle: React.CSSProperties = {
      ...switchSliderBeforeStyle,
      ...(checked ? { transform: "translateX(20px)" } : {}),
    };

    const computedLabelStyle: React.CSSProperties = {
      ...labelStyle,
      ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
    };

    return (
      <div className={className} style={containerStyle}>
        <label htmlFor={switchId} style={computedLabelStyle}>
          <span style={switchContainerStyle}>
            <input
              ref={ref}
              type="checkbox"
              id={switchId}
              role="switch"
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              style={switchInputStyle}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
              aria-errormessage={errorId}
              aria-checked={checked}
              {...props}
            />
            <span style={computedSliderStyle}>
              <span style={computedSliderBeforeStyle} />
            </span>
          </span>
          {label && <span>{label}</span>}
        </label>
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="text-sm text-danger-text"
            style={{ margin: 0, marginLeft: "calc(44px + var(--space-sm))" }}
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
              marginLeft: "calc(44px + var(--space-sm))",
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

Switch.displayName = "Switch";
