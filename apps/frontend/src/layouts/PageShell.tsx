import React from "react";

export interface PageShellProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  mainId?: string;
  skipLinkLabel?: string;
}

export const PageShell: React.FC<PageShellProps> = ({
  header,
  footer,
  children,
  mainId,
  skipLinkLabel,
}) => (
  <div data-component="page-shell">
    {mainId && skipLinkLabel ? (
      <a href={`#${mainId}`} className="skip-link">
        {skipLinkLabel}
      </a>
    ) : null}
    {header}
    <main id={mainId} data-slot="page-shell-main">
      {children}
    </main>
    {footer}
  </div>
);
