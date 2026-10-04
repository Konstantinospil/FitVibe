/**
 * Maintenance Banner Component
 *
 * Displays a banner when the system is in read-only mode.
 * Part of F-15 implementation for kill-switch visibility.
 */

import React from "react";
import { useReadOnlyMode } from "../utils/featureFlags";
import { useTranslation } from "react-i18next";

const bannerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  color: "#0f172a",
  padding: "0.85rem 1.5rem",
  textAlign: "center",
  fontSize: "0.95rem",
  fontWeight: 600,
  borderBottom: "2px solid #b45309",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.75rem",
};

const iconStyle: React.CSSProperties = {
  fontSize: "1.25rem",
};

export const MaintenanceBanner: React.FC = () => {
  const { t } = useTranslation();
  const { readOnlyMode, message } = useReadOnlyMode();

  if (!readOnlyMode) {
    return null;
  }

  return (
    <div style={bannerStyle} role="alert" aria-live="assertive">
      <span aria-hidden="true" style={iconStyle}>
        🛠️
      </span>
      <span>{message || t("components.maintenanceBanner.message")}</span>
    </div>
  );
};

export default MaintenanceBanner;
