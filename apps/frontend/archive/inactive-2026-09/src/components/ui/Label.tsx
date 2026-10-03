import React from "react";
import { useTranslation } from "react-i18next";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
  error?: boolean;
}

/**
 * Label component for form fields with required indicator and error state support.
 * Provides consistent styling and accessibility attributes.
 */
export const Label: React.FC<LabelProps> = ({
  children,
  required,
  error,
  className,
  style,
  ...props
}) => {
  const { t } = useTranslation("common");

  const labelStyle: React.CSSProperties = {
    color: error ? "var(--color-danger-text)" : "var(--color-text-primary)",
    fontWeight: 500,
    fontSize: "var(--font-size-sm)",
    display: "block",
    marginBottom: "var(--space-xs)",
    ...style,
  };

  return (
    <label className={className} style={labelStyle} {...props}>
      {children}
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
  );
};
