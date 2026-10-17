import React from "react";
import "./LegalDocumentShell.css";
import { CustomScrollbar } from "./CustomScrollbar";

export interface LegalDocumentShellProps {
  title: React.ReactNode;
  effectiveDate?: React.ReactNode;
  version?: React.ReactNode;
  legacyNotice?: React.ReactNode;
  children: React.ReactNode;
  footerAction?: React.ReactNode;
}

const LegalDocumentShell: React.FC<LegalDocumentShellProps> = ({
  title,
  effectiveDate,
  version,
  legacyNotice,
  children,
  footerAction,
}) => (
  <section className="legal-document-shell" data-component="legal-document-shell">
    <header className="legal-document-shell__header">
      <h1 className="legal-document-shell__title">{title}</h1>

      <div className="legal-document-shell__metadata">
        {effectiveDate ? (
          <span>
            <strong>Effective date:</strong> {effectiveDate}
          </span>
        ) : null}
        {version ? (
          <span className="legal-document-shell__version">
            <strong>Version:</strong> {version}
          </span>
        ) : null}
      </div>

      {legacyNotice ? (
        <div className="legal-document-shell__legacy-note">{legacyNotice}</div>
      ) : null}
    </header>

    <div className="legal-document-shell__viewport">
      <CustomScrollbar
        className="legal-document-shell__scroll"
        viewportClassName="legal-document-shell__content"
        label="Legal document"
      >
        {children}
      </CustomScrollbar>
    </div>

    {footerAction ? <footer className="legal-document-shell__footer">{footerAction}</footer> : null}
  </section>
);

export default LegalDocumentShell;
