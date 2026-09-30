import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "../ui/Button";
import { exportProgress } from "../../services/api";
import { logger } from "../../utils/logger";
import { useToast } from "../../contexts/ToastContext";

export type ExportFormat = "csv" | "json";

export interface ProgressExportProps {
  format?: ExportFormat;
  filename?: string;
  onExportStart?: () => void;
  onExportSuccess?: () => void;
  onExportError?: (error: string) => void;
}

/**
 * ProgressExport component provides CSV/JSON export functionality for progress data.
 */
export const ProgressExport: React.FC<ProgressExportProps> = ({
  format = "csv",
  filename,
  onExportStart,
  onExportSuccess,
  onExportError,
}) => {
  const { t } = useTranslation("common");
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      onExportStart?.();

      const blob = await exportProgress();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        filename || `fitvibe-progress-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t("progress.exportCsv") || "Progress data exported successfully");
      onExportSuccess?.();
    } catch (error) {
      const errorMessage = t("progress.exportFailed") || "Failed to export progress data";
      logger.apiError("Export failed", error, "/api/v1/progress/export", "GET");
      toast.error(errorMessage);
      onExportError?.(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void handleExport()}
      isLoading={isExporting}
      disabled={isExporting}
      leftIcon={<Download size={16} />}
    >
      {isExporting
        ? t("common.loading")
        : format === "csv"
          ? t("progress.exportCsv")
          : "Export JSON"}
    </Button>
  );
};
