import React from "react";

export type CardVariant = "surface" | "muted";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: keyof React.JSX.IntrinsicElements;
  variant?: CardVariant;
}

const cardVariants: Record<CardVariant, React.CSSProperties> = {
  surface: {
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
    boxShadow: "var(--shadow-e1)",
  },
  muted: {
    background: "var(--color-surface-muted)",
    borderColor: "var(--color-border)",
    boxShadow: "none",
  },
};

export const Card: React.FC<CardProps> = ({
  children,
  as = "div",
  variant = "surface",
  style,
  ...rest
}) => {
  const Component = as as React.ElementType;
  return (
    <Component
      data-component="card"
      data-variant={variant}
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid",
        display: "flex",
        flexDirection: "column",
        color: "var(--color-text-primary)",
        ...cardVariants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLElement>> = ({
  children,
  style,
  ...rest
}) => (
  <header
    style={{
      padding: "var(--space-md) var(--space-md) var(--space-sm)",
      display: "grid",
      gap: "var(--space-xs)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </header>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  style,
  ...rest
}) => (
  <h3
    style={{
      margin: 0,
      fontFamily: "var(--font-family-heading)",
      fontWeight: "var(--font-weight-semibold)",
      fontSize: "var(--type-card-title-size)",
      lineHeight: "var(--type-card-title-line-height)",
      letterSpacing: "var(--type-card-title-letter-spacing)",
      color: "var(--color-text-primary)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  style,
  ...rest
}) => (
  <p
    style={{
      margin: 0,
      fontFamily: "var(--font-family-body)",
      fontWeight: "var(--font-weight-regular)",
      fontSize: "var(--type-supporting-size)",
      lineHeight: "var(--type-supporting-line-height)",
      letterSpacing: "var(--type-supporting-letter-spacing)",
      color: "var(--color-text-muted)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...rest
}) => (
  <div
    style={{
      padding: "var(--space-sm) var(--space-md) var(--space-md)",
      display: "grid",
      gap: "var(--space-sm)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...rest
}) => (
  <div
    style={{
      padding: "var(--space-sm) var(--space-md) var(--space-md)",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "var(--space-sm)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);
