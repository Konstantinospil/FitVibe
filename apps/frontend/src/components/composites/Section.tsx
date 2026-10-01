import React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
}

export const Section: React.FC<SectionProps> = ({ as = "section", children, style, ...props }) => {
  const Component = as;
  return (
    <Component
      {...props}
      data-component="section"
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
};

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actions,
  style,
  ...props
}) => (
  <header
    {...props}
    data-component="section-header"
    style={{
      display: "grid",
      gridTemplateColumns: actions ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
      gap: "var(--space-md)",
      alignItems: "start",
      ...style,
    }}
  >
    <div style={{ display: "grid", gap: "var(--space-xs)" }}>
      <h2
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family-heading)",
          fontWeight: "var(--font-weight-semibold)",
          fontSize: "var(--type-section-title-size)",
          lineHeight: "var(--type-section-title-line-height)",
          letterSpacing: "var(--type-section-title-letter-spacing)",
        }}
      >
        {title}
      </h2>
      {description ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontWeight: "var(--font-weight-regular)",
            fontSize: "var(--type-body-size)",
            lineHeight: "var(--type-body-line-height)",
            letterSpacing: "var(--type-body-letter-spacing)",
          }}
        >
          {description}
        </p>
      ) : null}
    </div>
    {actions}
  </header>
);
