import React, { forwardRef } from "react";

export type FieldControlSize = "sm" | "md" | "lg";
export type FieldControlVariant = "default" | "error";

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
  borderRadius: "var(--field-radius, var(--radius-xl))",
  border: "1px solid var(--color-input-border, var(--color-border))",
  background: "var(--color-input-bg)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-family-base)",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
  outline: "none",
};

const errorStyle: React.CSSProperties = {
  borderColor: "var(--color-danger-border)",
};

const disabledStyle: React.CSSProperties = {
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
    element.style.boxShadow = "var(--focus-glow)";
  }
};

const blurControl = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  element.style.borderColor = "";
  element.style.boxShadow = "";
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
