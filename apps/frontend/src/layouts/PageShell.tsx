import React, { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomScrollbar } from "../components/CustomScrollbar";

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
}) => {
  const { t } = useTranslation();
  const [footerCollapsed, setFooterCollapsed] = useState(false);
  const footerId = useId();
  return (
    <div data-component="page-shell">
      {mainId && skipLinkLabel ? (
        <a href={`#${mainId}`} className="skip-link">
          {skipLinkLabel}
        </a>
      ) : null}
      {header}
      <main id={mainId} data-slot="page-shell-main">
        <CustomScrollbar className="page-shell-content-scroll" label={t("scrollbar.pageLabel")}>
          {children}
        </CustomScrollbar>
      </main>
      {footer ? (
        <div data-component="page-shell-footer" data-collapsed={footerCollapsed}>
          <button
            type="button"
            data-slot="footer-toggle"
            aria-expanded={!footerCollapsed}
            aria-controls={footerId}
            aria-label={footerCollapsed ? t("footer.expand") : t("footer.collapse")}
            onClick={() => setFooterCollapsed((collapsed) => !collapsed)}
          >
            {footerCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
          <div id={footerId} data-slot="footer-collapsible" hidden={footerCollapsed}>
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
};
