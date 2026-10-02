import React, { forwardRef, useId, useState } from "react";

export type FieldControlSize = "sm" | "md" | "lg";
export type FieldControlVariant = "default" | "error";
export type InputFieldState = "default" | "focus" | "error" | "disabled";
export type SelectFieldState = "default" | "focus" | "error" | "disabled";
export type TextareaFieldState = "default" | "focus" | "error" | "disabled";

const sizeStyles: Record<FieldControlSize, React.CSSProperties> = {
  sm: {
    padding: "var(--space-xs) var(--space-sm)",
    fontSize: "var(--font-size-sm)",
  },
  md: {
    padding: "var(--space-sm) var(--space-md)",
    fontSize: "var(--font-size-md)",
  },
  lg: {
    padding: "var(--space-md) var(--space-lg)",
    fontSize: "var(--font-size-lg)",
  },
};

const selectPaddingRight: Record<FieldControlSize, string> = {
  sm: "calc(var(--space-sm) + 20px + var(--space-xs))",
  md: "calc(var(--space-md) + 20px + var(--space-sm))",
  lg: "calc(var(--space-lg) + 20px + var(--space-md))",
};

const baseStyle: React.CSSProperties = {
  width: "100%",
  height: "38px",
  minHeight: "38px",
  padding: "var(--space-xs) var(--space-md)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-input-border)",
  background: "var(--color-input-bg)",
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-family-body)",
  fontWeight: "var(--font-weight-regular)",
  fontSize: "var(--type-control-size)",
  lineHeight: "var(--type-control-line-height)",
  letterSpacing: "var(--type-control-letter-spacing)",
  transition: "border-color 150ms ease",
  outline: "none",
  boxShadow: "none",
};

const errorStyle: React.CSSProperties = {
  borderColor: "var(--color-danger-border)",
};

const disabledStyle: React.CSSProperties = {
  background: "var(--color-surface-muted)",
  opacity: "var(--opacity-disabled)",
  cursor: "not-allowed",
};

const focusControl = (
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  invalid: boolean,
  disabled: boolean,
) => {
  if (!invalid && !disabled) {
    element.style.borderColor = "var(--color-highlight)";
  }
};

const blurControl = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  element.style.borderColor = "";
};

export interface InputControlProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  controlSize?: FieldControlSize;
  variant?: FieldControlVariant;
}

export const InputControl = forwardRef<HTMLInputElement, InputControlProps>(
  (
    {
      controlSize = "md",
      variant = "default",
      disabled = false,
      style,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const invalid =
      variant === "error" ||
      props["aria-invalid"] === true ||
      props["aria-invalid"] === "true";
    return (
      <input
        ref={ref}
        disabled={disabled}
        style={{
          ...baseStyle,
          ...sizeStyles[controlSize],
          ...(invalid ? errorStyle : {}),
          ...(disabled ? disabledStyle : {}),
          ...style,
        }}
        onFocus={(event) => {
          focusControl(event.currentTarget, invalid, disabled);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          blurControl(event.currentTarget);
          onBlur?.(event);
        }}
        {...props}
      />
    );
  },
);
InputControl.displayName = "InputControl";

export interface InputFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "style" | "className" | "disabled" | "aria-invalid"
  > {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
  endAdornment?: React.ReactNode;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      id,
      label,
      helperText,
      error = false,
      disabled = false,
      endAdornment,
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

    const state: InputFieldState = disabled
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
        data-component="input-field"
        data-state={state}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          gap: "var(--space-xs)",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
        }}
      >
        <label
          htmlFor={inputId}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: "32px",
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
            disabled={disabled}
            variant={error ? "error" : "default"}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={helperId}
            style={{
              borderColor,
              background:
                state === "disabled" ? "var(--color-surface-muted)" : "var(--color-input-bg)",
              opacity: "var(--opacity-full)",
              padding: endAdornment
                ? "var(--space-xs) calc(var(--space-md) + var(--space-xl)) var(--space-xs) var(--space-md)"
                : "var(--space-xs) var(--space-md)",
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
          {endAdornment ? (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: "var(--space-sm)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {endAdornment}
            </span>
          ) : null}
        </div>

        {helperText ? (
          <div
            id={helperId}
            style={{
              width: "100%",
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
InputField.displayName = "InputField";


export interface SelectControlProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  controlSize?: FieldControlSize;
  variant?: FieldControlVariant;
}

export const SelectControl = forwardRef<HTMLSelectElement, SelectControlProps>(
  (
    {
      controlSize = "md",
      variant = "default",
      disabled = false,
      style,
      onFocus,
      onBlur,
      children,
      ...props
    },
    ref,
  ) => {
    const invalid =
      variant === "error" ||
      props["aria-invalid"] === true ||
      props["aria-invalid"] === "true";
    return (
      <select
        ref={ref}
        disabled={disabled}
        style={{
          ...baseStyle,
          ...sizeStyles[controlSize],
          paddingRight: selectPaddingRight[controlSize],
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          ...(invalid ? errorStyle : {}),
          ...(disabled ? disabledStyle : {}),
          ...style,
        }}
        onFocus={(event) => {
          focusControl(event.currentTarget, invalid, disabled);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          blurControl(event.currentTarget);
          onBlur?.(event);
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);
SelectControl.displayName = "SelectControl";

export interface SelectFieldProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "size" | "style" | "className" | "disabled" | "aria-invalid"
  > {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      id,
      label,
      helperText,
      error = false,
      disabled = false,
      children,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const helperId = helperText ? `${selectId}-helper` : undefined;
    const [focused, setFocused] = useState(false);

    const state: SelectFieldState = disabled
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
        data-component="select-field"
        data-state={state}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          gap: "var(--space-xs)",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
        }}
      >
        <label
          htmlFor={selectId}
          style={{
            display: "flex",
            alignItems: "center",
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
            display: "flex",
            alignItems: "center",
            width: "100%",
          }}
        >
          <SelectControl
            {...props}
            id={selectId}
            ref={ref}
            disabled={disabled}
            variant={error ? "error" : "default"}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={helperId}
            style={{
              height: "38px",
              minHeight: "38px",
              padding: "var(--space-xs) calc(var(--space-xl) + var(--space-md)) var(--space-xs) var(--space-md)",
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
          >
            {children}
          </SelectControl>

          <span
            aria-hidden="true"
            data-slot="select-chevron"
            style={{
              position: "absolute",
              right: "var(--space-md)",
              width: "var(--space-sm)",
              height: "var(--space-sm)",
              borderRight: "2px solid currentColor",
              borderBottom: "2px solid currentColor",
              color: "var(--color-text-secondary)",
              transform: "translateY(calc(var(--space-xs) * -1)) rotate(45deg)",
              pointerEvents: "none",
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
SelectField.displayName = "SelectField";


export interface TextareaControlProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  controlSize?: FieldControlSize;
  variant?: FieldControlVariant;
}

export const TextareaControl = forwardRef<HTMLTextAreaElement, TextareaControlProps>(
  (
    {
      controlSize = "md",
      variant = "default",
      disabled = false,
      style,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const invalid =
      variant === "error" ||
      props["aria-invalid"] === true ||
      props["aria-invalid"] === "true";
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        style={{
          ...baseStyle,
          ...sizeStyles[controlSize],
          resize: "vertical",
          ...(invalid ? errorStyle : {}),
          ...(disabled ? disabledStyle : {}),
          ...style,
        }}
        onFocus={(event) => {
          focusControl(event.currentTarget, invalid, disabled);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          blurControl(event.currentTarget);
          onBlur?.(event);
        }}
        {...props}
      />
    );
  },
);
TextareaControl.displayName = "TextareaControl";


export interface TextareaFieldProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "style" | "className" | "disabled" | "aria-invalid"
  > {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  (
    {
      id,
      label,
      helperText,
      error = false,
      disabled = false,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const [focused, setFocused] = useState(false);

    const state: TextareaFieldState = disabled
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
        data-component="textarea-field"
        data-state={state}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          gap: "var(--space-xs)",
          opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
        }}
      >
        <label
          htmlFor={textareaId}
          style={{
            display: "flex",
            alignItems: "center",
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

        <TextareaControl
          {...props}
          id={textareaId}
          ref={ref}
          disabled={disabled}
          variant={error ? "error" : "default"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={helperId}
          style={{
            minHeight: "var(--textarea-min-height)",
            borderColor,
            background:
              state === "disabled" ? "var(--color-surface-muted)" : "var(--color-input-bg)",
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
TextareaField.displayName = "TextareaField";
