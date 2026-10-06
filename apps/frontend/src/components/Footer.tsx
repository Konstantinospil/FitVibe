import React from "react";
import {NavLink} from "react-router-dom";
import {useTranslation} from "react-i18next";
import BrandLogo from "./BrandLogo";
import {TextLink} from "@fitvibe/ui";
import FooterSocialLinks from "./FooterSocialLinks";

export const Footer: React.FC = () => {
  const {t}=useTranslation();
  return (
    <footer role="contentinfo" data-component="app-footer">
      <div data-slot="footer-container">
        <BrandLogo size="sm" />
        <nav aria-label={t("footer.navigationLabel",{defaultValue:"Footer navigation"})}>
          <div data-slot="footer-links">
            <TextLink as={NavLink} to="/contact" aria-label={t("footer.contactAriaLabel",{defaultValue:"Contact us"})}>
              {t("footer.contact",{defaultValue:"Contact"})}
            </TextLink>
            <TextLink as={NavLink} to="/terms" aria-label={t("footer.termsAriaLabel",{defaultValue:"View Terms and Conditions"})}>
              {t("footer.terms")}
            </TextLink>
            <TextLink as={NavLink} to="/privacy" aria-label={t("footer.privacyAriaLabel",{defaultValue:"View Privacy Policy"})}>
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
