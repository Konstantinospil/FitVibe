import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@fitvibe/ui";

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  /** Skip expensive backdrop blur so the heading can paint as LCP sooner. */
  priorityLcp?: boolean;
  brand?: React.ReactNode;
  actions?: React.ReactNode;
}

// Separate concerns: layout container vs typography
const eyebrowContainerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.6rem",
};

const eyebrowTextStyle: React.CSSProperties = {
  fontSize: "var(--type-supporting-size)",
  letterSpacing: "var(--type-metric-small-letter-spacing)",
  textTransform: "uppercase",
  fontWeight: "var(--font-weight-semibold)",
  color: "var(--color-text-secondary)",
};

const accentLineStyle: React.CSSProperties = {
  width: "24px",
  height: "2px",
  background: "var(--color-accent)",
};

const PageIntro: React.FC<PageIntroProps> = ({
  eyebrow,
  title,
  description,
  children,
  priorityLcp = false,
  brand,
  actions,
}) => (
  <section
    style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "clamp(2rem, 8vw, 5rem) clamp(1rem, 4vw, 1.5rem)",
    }}
  >
    <Card
      as="article"
      style={{
        maxWidth: "900px",
        width: "100%",
        padding: "0",
        gap: "0",
        ...(priorityLcp ? { backdropFilter: "none" } : {}),
      }}
    >
      <CardHeader
        style={{
          padding: "3rem clamp(1.5rem, 5vw, 3.5rem) 1.5rem",
          gap: "1rem",
        }}
      >
        {brand ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
              marginBottom: "0.5rem",
            }}
          >
            {brand}
          </div>
        ) : null}
        {eyebrow ? (
          <span style={eyebrowContainerStyle}>
            <span style={accentLineStyle} aria-hidden="true" />
            <span style={eyebrowTextStyle}>{eyebrow}</span>
          </span>
        ) : null}
        <CardTitle
          style={{
            fontSize: "clamp(var(--type-page-title-size), 4vw, var(--type-display-size))",
            lineHeight: "var(--type-page-title-line-height)",
            letterSpacing: "var(--type-page-title-letter-spacing)",
            ...(priorityLcp
              ? {
                  color: "var(--color-text-primary, var(--color-on-color))",
                  fontFamily: "var(--font-family-body)",
                }
              : {}),
          }}
        >
          {title}
        </CardTitle>
        <CardDescription
          style={{
            fontSize: "var(--type-body-size)",
            lineHeight: "var(--type-body-line-height)",
          }}
        >
          {description}
        </CardDescription>
      </CardHeader>
      {actions ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0 clamp(1.5rem, 4vw, 3rem) 1rem",
          }}
        >
          {actions}
        </div>
      ) : null}
      {children ? (
        <CardContent
          style={{
            padding: `0 clamp(1.5rem, 4vw, 3rem) 3rem`,
            gap: "1.5rem",
          }}
        >
          {children}
        </CardContent>
      ) : null}
    </Card>
  </section>
);

export default PageIntro;
