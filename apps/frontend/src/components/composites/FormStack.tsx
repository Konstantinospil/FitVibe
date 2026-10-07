import React from "react";

type FormStackBaseProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

type FormStackFormProps = FormStackBaseProps &
  Omit<React.FormHTMLAttributes<HTMLFormElement>, "children" | "style"> & {
    as?: "form";
  };

type FormStackDivProps = FormStackBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "style"> & {
    as: "div";
  };

export type FormStackProps = FormStackFormProps | FormStackDivProps;

export const FormStack = React.forwardRef<HTMLFormElement | HTMLDivElement, FormStackProps>(
  ({ as = "form", children, style, ...props }, ref) => {
    if (as === "div") {
      return (
        <div
          {...(props as React.HTMLAttributes<HTMLDivElement>)}
          ref={ref as React.Ref<HTMLDivElement>}
          data-component="form-stack"
          style={style}
        >
          {children}
        </div>
      );
    }

    return (
      <form
        {...(props as React.FormHTMLAttributes<HTMLFormElement>)}
        ref={ref as React.Ref<HTMLFormElement>}
        data-component="form-stack"
        style={style}
      >
        {children}
      </form>
    );
  },
);
FormStack.displayName = "FormStack";

export type FeedbackTone = "info" | "success" | "warning" | "danger";

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
    style={style}
  >
    {children}
  </div>
);

export const FormActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...props
}) => (
  <div {...props} data-component="form-actions" style={style}>
    {children}
  </div>
);
