import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@fitvibe/ui";

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  priorityLcp?: boolean;
  brand?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageIntro: React.FC<PageIntroProps> = ({
  eyebrow,
  title,
  description,
  children,
  priorityLcp = false,
  brand,
  actions,
}) => (
  <section data-component="page-intro">
    <Card
      as="article"
      data-slot="page-intro-card"
      data-priority-lcp={priorityLcp ? "true" : undefined}
    >
      <CardHeader>
        {brand ? <div data-slot="page-intro-brand">{brand}</div> : null}
        {eyebrow ? (
          <span data-slot="page-intro-eyebrow">
            <span data-slot="page-intro-accent" aria-hidden="true" />
            <span data-slot="page-intro-eyebrow-text">{eyebrow}</span>
          </span>
        ) : null}
        <CardTitle data-slot="page-intro-title">{title}</CardTitle>
        <CardDescription data-slot="page-intro-description">{description}</CardDescription>
      </CardHeader>
      {actions ? <div data-slot="page-intro-actions">{actions}</div> : null}
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  </section>
);

export default PageIntro;
