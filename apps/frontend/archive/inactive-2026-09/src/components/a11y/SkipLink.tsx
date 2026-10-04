import React from "react";
import { useTranslation } from "react-i18next";

export interface SkipLinkProps {
  href?: string;
  targetId?: string;
}

/**
 * SkipLink component for keyboard navigation.
 * Allows users to skip to main content, improving accessibility (WCAG 2.2 AA).
 */
export const SkipLink: React.FC<SkipLinkProps> = ({
  href = "#main-content",
  targetId = "main-content",
}) => {
  const { t } = useTranslation("common");

  const skipLinkStyle: React.CSSProperties = {
    position: "absolute",
    top: "-40px",
    left: "0",
    background: "var(--color-primary)",
    color: "var(--color-primary-on)",
    padding: "var(--space-sm) var(--space-md)",
    textDecoration: "none",
    borderRadius: "0 0 var(--radius-md) 0",
    zIndex: 10000,
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    transition: "top 150ms ease",
  };

  const skipLinkFocusStyle: React.CSSProperties = {
    top: "0",
  };

  return (
    <a
      href={href}
      className="skip-link"
      style={skipLinkStyle}
      onFocus={(e) => {
        Object.assign(e.currentTarget.style, skipLinkFocusStyle);
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = "-40px";
      }}
      onClick={(e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
    >
      {t("navigation.skipToContent") || "Skip to main content"}
    </a>
  );
};
