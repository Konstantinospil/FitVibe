import React from "react";
import { useTranslation } from "react-i18next";
import PublishedLegalDocument from "../components/PublishedLegalDocument";
import { CookiePreferences } from "../components/CookieConsent";
const Cookie: React.FC = () => {
  const { t } = useTranslation();
  return <><PublishedLegalDocument documentType="cookie" title={t("cookie.policy.title")} /><CookiePreferences /></>;
};
export default Cookie;
