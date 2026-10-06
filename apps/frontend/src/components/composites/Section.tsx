import React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
}

export const Section: React.FC<SectionProps> = ({
  as = "section",
  children,
  style,
  ...props
}) => {
  const Component = as;

  return (
    <Component {...props} data-component="section" style={style}>
      {children}
    </Component>
  );
};

export interface SectionHeaderProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
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
    data-has-actions={actions ? true : undefined}
    style={style}
  >
    <div data-slot="section-copy">
      <h2 data-slot="section-title">{title}</h2>
      {description ? <p data-slot="section-description">{description}</p> : null}
    </div>
    {actions}
  </header>
);
