import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Alert } from "../ui/Alert";
import { exportUserData } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface DataExportButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * DataExportButton component for triggering GDPR-compliant data export.
 * Downloads user data as a ZIP file containing JSON/CSV exports.
 */
export const DataExportButton: React.FC<DataExportButtonProps> = ({
  variant = "secondary",
  size = "md",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitvibe-export-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        variant: "success",
        title: t("settings.dataExport.success") || "Export Started",
        message: t("settings.dataExport.successMessage") || "Your data export has been downloaded",
      });
      setShowModal(false);
    } catch {
      showToast({
        variant: "error",
        title: t("settings.dataExport.failed") || "Export Failed",
        message:
          t("settings.dataExport.failedMessage") || "Failed to export data. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowModal(true)}
        leftIcon={<Download size={18} />}
      >
        {t("settings.dataExport.export") || "Export My Data"}
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t("settings.dataExport.title") || "Export Your Data"}
        size="md"
      >
        <div className="flex flex--column flex--gap-lg">
          <Alert variant="info">
            {t("settings.dataExport.description") ||
              "You can download a copy of all your personal data stored in FitVibe. This includes your profile, sessions, exercises, and progress data."}
          </Alert>

          <div className="flex flex--column flex--gap-sm">
            <h4 className="text-sm font-weight-600 m-0">
              {t("settings.dataExport.whatIncluded") || "What's included:"}
            </h4>
            <ul className="list" style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
              <li className="list-item">
                {t("settings.dataExport.profile") || "Profile information"}
              </li>
              <li className="list-item">
                {t("settings.dataExport.sessions") || "All training sessions"}
              </li>
              <li className="list-item">
                {t("settings.dataExport.exercises") || "Exercise library"}
              </li>
              <li className="list-item">
                {t("settings.dataExport.progress") || "Progress and analytics data"}
              </li>
              <li className="list-item">
                {t("settings.dataExport.settings") || "Account settings"}
              </li>
            </ul>
          </div>

          <Alert variant="warning">
            {t("settings.dataExport.processingTime") ||
              "Large exports may take a few minutes to process. You'll receive a download link when ready."}
          </Alert>

          <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void handleExport();
              }}
              isLoading={isExporting}
            >
              {t("settings.dataExport.download") || "Download Export"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
