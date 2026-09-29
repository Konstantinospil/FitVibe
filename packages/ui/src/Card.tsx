import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: keyof React.JSX.IntrinsicElements;
}

const cardBaseStyle: React.CSSProperties = {
  background: "var(--card-background, var(--color-bg-card))",
  borderRadius: "var(--card-radius, var(--radius-xl))",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--card-shadow, var(--shadow-e2))",
  backdropFilter: "var(--card-backdrop-filter, none)",
  display: "flex",
  flexDirection: "column",
};

export const Card: React.FC<CardProps> = ({ children, as = "div", style, ...rest }) => {
  const Component = as as React.ElementType;
  return (
    <Component style={{ ...cardBaseStyle, ...style }} {...rest}>
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
      padding: "var(--space-lg) var(--space-xl) var(--space-sm)",
      display: "grid",
      gap: "var(--space-sm)",
      borderBottom: "1px solid var(--card-header-divider-color, var(--color-border-strong))",
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
      fontSize: "var(--font-size-lg)",
      fontFamily: "var(--font-family-heading)",
      fontWeight: 600,
      letterSpacing: "var(--letter-spacing-tight)",
      lineHeight: "var(--line-height-snug)",
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
      fontSize: "var(--font-size-sm)",
      color: "var(--color-text-muted)",
      lineHeight: "var(--line-height-relaxed)",
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
      padding: "var(--space-lg) var(--space-xl)",
      display: "grid",
      gap: "var(--space-md)",
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
      padding: "var(--space-md) var(--space-xl) calc(var(--space-xl) - 0.25rem)",
      borderTop: "1px solid var(--card-footer-divider-color, var(--color-border-strong))",
      display: "flex",
      justifyContent: "flex-end",
      gap: "var(--space-sm)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);
