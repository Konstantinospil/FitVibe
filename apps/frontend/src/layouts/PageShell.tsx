import React from "react";

export interface PageShellProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  mainId?: string;
  skipLinkLabel?: string;
  mainStyle?: React.CSSProperties;
}

export const PageShell: React.FC<PageShellProps> = ({
  header,
  footer,
  children,
  mainId,
  skipLinkLabel,
  mainStyle,
}) => (
  <div
    data-component="page-shell"
    style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {mainId && skipLinkLabel ? (
      <a href={`#${mainId}`} className="skip-link">
        {skipLinkLabel}
      </a>
    ) : null}
    {header}
    <main
      id={mainId}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        ...mainStyle,
      }}
    >
      {children}
    </main>
    {footer}
  </div>
);
