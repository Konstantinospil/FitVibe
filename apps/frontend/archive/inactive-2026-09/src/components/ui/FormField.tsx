import React from "react";
import type { InputProps } from "./Input";
import { Input } from "./Input";

export interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

/**
 * FormField is a wrapper component that combines Input with label, error, and helper text.
 * It provides a consistent form field structure with proper accessibility attributes.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required,
  ...inputProps
}) => {
  return (
    <Input
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      variant={error ? "error" : "default"}
      {...inputProps}
    />
  );
};
