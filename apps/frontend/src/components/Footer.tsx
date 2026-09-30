import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "./BrandLogo";
import { TextLink } from "@fitvibe/ui";
import FooterSocialLinks from "./FooterSocialLinks";

/**
 * Footer component that appears on all pages.
 * Displays FitVibe branding, page links, and social-media destinations.
 * WCAG 2.1 AA compliant with proper semantic HTML and keyboard navigation.
 */
export const Footer: React.FC = () => {
  const { t } = useTranslation();

  const footerStyle: React.CSSProperties = {
    padding: "2rem 0",
    textAlign: "center",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    borderTop: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface)",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "0 clamp(1rem, 5vw, 2.5rem)",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    alignItems: "center",
  };

  const linksContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1.5rem",
    flexWrap: "wrap",
  };

  return (
    <footer role="contentinfo" style={footerStyle}>
      <div style={containerStyle}>
        <BrandLogo size="sm" />
        <nav aria-label={t("footer.navigationLabel", { defaultValue: "Footer navigation" })}>
          <div style={linksContainerStyle}>
            <TextLink
              as={NavLink}
              to="/contact"
              aria-label={t("footer.contactAriaLabel", { defaultValue: "Contact us" })}
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--type-supporting-size)",
              }}
            >
              {t("footer.contact", { defaultValue: "Contact" })}
            </TextLink>
            <TextLink
              as={NavLink}
              to="/terms"
              aria-label={t("footer.termsAriaLabel", { defaultValue: "View Terms and Conditions" })}
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--type-supporting-size)",
              }}
            >
              {t("footer.terms")}
            </TextLink>
            <TextLink
              as={NavLink}
              to="/privacy"
              aria-label={t("footer.privacyAriaLabel", { defaultValue: "View Privacy Policy" })}
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--type-supporting-size)",
              }}
            >
              {t("footer.privacy")}
            </TextLink>
          </div>
        </nav>
        <FooterSocialLinks />
      </div>
    </footer>
  );
};

export default Footer;
