import React from "react";

export type FormStackProps = React.FormHTMLAttributes<HTMLFormElement> & {
  as?: "form" | "div";
};

export const FormStack = React.forwardRef<HTMLFormElement | HTMLDivElement, FormStackProps>(
  ({ as = "form", children, style, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        {...props}
        ref={ref as never}
        data-component="form-stack"
        style={{
          width: "100%",
          display: "grid",
          gap: "var(--space-md)",
          ...style,
        }}
      >
        {children}
      </Component>
    );
  },
);
FormStack.displayName = "FormStack";

export type FeedbackTone = "info" | "success" | "warning" | "danger";

const feedbackStyles: Record<FeedbackTone, React.CSSProperties> = {
  info: {
    color: "var(--color-info-text)",
    background: "var(--surface-info-subtle)",
    borderColor: "var(--border-info-subtle)",
  },
  success: {
    color: "var(--color-success-text)",
    background: "var(--surface-success-subtle)",
    borderColor: "var(--border-success-subtle)",
  },
  warning: {
    color: "var(--color-warning-text)",
    background: "var(--surface-warning-subtle)",
    borderColor: "var(--border-warning-subtle)",
  },
  danger: {
    color: "var(--color-danger-text)",
    background: "var(--surface-danger-subtle)",
    borderColor: "var(--border-danger-subtle)",
  },
};

export interface FormFeedbackProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
}

export const FormFeedback: React.FC<FormFeedbackProps> = ({
  tone = "danger",
  children,
  style,
  role,
  ...props
}) => (
  <div
    {...props}
    role={role ?? (tone === "danger" ? "alert" : "status")}
    data-component="form-feedback"
    data-tone={tone}
    style={{
      padding: "var(--space-sm) var(--space-md)",
      border: "1px solid",
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-family-body)",
      fontSize: "var(--type-supporting-size)",
      lineHeight: "var(--type-supporting-line-height)",
      ...feedbackStyles[tone],
      ...style,
    }}
  >
    {children}
  </div>
);

export const FormActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...props
}) => (
  <div
    {...props}
    data-component="form-actions"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      flexWrap: "wrap",
      ...style,
    }}
  >
    {children}
  </div>
);
