import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Alert } from "../ui/Alert";

export interface BackupCodesDisplayProps {
  backupCodes: string[];
  onCodesCopied?: () => void;
  onDownload?: () => void;
}

/**
 * BackupCodesDisplay component for displaying 2FA backup codes.
 * Provides copy, download, and hide/show functionality.
 */
export const BackupCodesDisplay: React.FC<BackupCodesDisplayProps> = ({
  backupCodes,
  onCodesCopied,
  onDownload,
}) => {
  const { t } = useTranslation("common");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const allCodes = backupCodes.join("\n");
    try {
      await navigator.clipboard.writeText(allCodes);
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
      onCodesCopied?.();
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = allCodes;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
      onCodesCopied?.();
    }
  };

  const handleDownload = () => {
    const content = `FitVibe Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join("\n")}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitvibe-backup-codes-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  const codeItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-sm) var(--space-md)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-family-mono)",
    fontSize: "var(--font-size-md)",
    letterSpacing: "0.1em",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.2fa.backupCodes") || "Backup Codes"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="warning" style={{ marginBottom: "var(--space-lg)" }}>
          {t("auth.2fa.backupCodesWarning") ||
            "Save these backup codes in a safe place. Each code can only be used once."}
        </Alert>

        <div className="flex flex--column flex--gap-md" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="flex flex--align-center flex--justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCodes(!showCodes)}
              leftIcon={showCodes ? <EyeOff size={16} /> : <Eye size={16} />}
            >
              {showCodes ? t("common.hide") || "Hide" : t("common.show") || "Show"}
            </Button>
            <div className="flex flex--gap-sm">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyAll()}
                leftIcon={allCopied ? <Check size={16} /> : <Copy size={16} />}
              >
                {allCopied ? t("common.copied") || "Copied" : t("common.copyAll") || "Copy All"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                leftIcon={<Download size={16} />}
              >
                {t("common.download") || "Download"}
              </Button>
            </div>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "var(--space-sm)",
            }}
          >
            {backupCodes.map((code, index) => (
              <div key={index} style={codeItemStyle}>
                <span>{showCodes ? code : "•".repeat(code.length)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopyCode(code, index)}
                  leftIcon={copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                  style={{ minWidth: "auto", padding: "0.25rem" }}
                  aria-label={t("common.copy") || "Copy code"}
                />
              </div>
            ))}
          </div>
        </div>

        <Alert variant="info">
          {t("auth.2fa.backupCodesInfo") ||
            "If you lose access to your authenticator app, you can use these codes to sign in."}
        </Alert>
      </CardContent>
    </Card>
  );
};
