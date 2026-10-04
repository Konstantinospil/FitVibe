import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { SelectControl, type FieldControlSize, type FieldControlVariant } from "@fitvibe/ui";

export type SelectSize = FieldControlSize;
export type SelectVariant = FieldControlVariant;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SelectSize;
  variant?: SelectVariant;
  options: SelectOption[];
  placeholder?: string;
}

const wrapperStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
};

const iconStyle: React.CSSProperties = {
  position: "absolute",
  right: "var(--space-md)",
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "var(--color-text-muted)",
  width: "20px",
  height: "20px",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      size = "md",
      variant = "default",
      options,
      placeholder,
      className,
      id,
      required,
      disabled,
      style,
      value,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const selectId = id || `select-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;

    return (
      <div className="flex flex--column flex--gap-xs" style={{ width: "100%" }}>
        {label && (
          <label
            htmlFor={selectId}
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
        <div style={wrapperStyle}>
          <SelectControl
            ref={ref}
            id={selectId}
            className={className}
            controlSize={size}
            variant={error ? "error" : variant}
            style={style}
            disabled={disabled}
            required={required}
            value={value}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
            aria-errormessage={errorId}
            aria-required={required}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </SelectControl>
          <ChevronDown style={iconStyle} aria-hidden="true" />
        </div>
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

Select.displayName = "Select";
