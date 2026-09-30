import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useToast } from "../ui/Toast";
import { reportFeedItem } from "../../services/api";

export interface ReportButtonProps {
  feedItemId: string;
  onReported?: () => void;
  size?: "sm" | "md" | "lg";
}

/**
 * ReportButton component for reporting inappropriate content.
 * Opens a modal with report reason and optional details.
 */
export const ReportButton: React.FC<ReportButtonProps> = ({
  feedItemId,
  onReported,
  size = "sm",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const reportReasons = [
    { value: "spam", label: t("feed.report.reasons.spam") || "Spam" },
    { value: "harassment", label: t("feed.report.reasons.harassment") || "Harassment" },
    {
      value: "inappropriate",
      label: t("feed.report.reasons.inappropriate") || "Inappropriate Content",
    },
    { value: "copyright", label: t("feed.report.reasons.copyright") || "Copyright Violation" },
    { value: "other", label: t("feed.report.reasons.other") || "Other" },
  ];

  const handleSubmit = async () => {
    if (!reason) {
      return;
    }

    setIsSubmitting(true);
    try {
      await reportFeedItem(feedItemId, { reason, details: details || undefined });
      showToast({
        variant: "success",
        title: t("feed.report.submitted") || "Report Submitted",
        message:
          t("feed.report.submittedMessage") ||
          "Thank you for your report. We'll review it shortly.",
      });
      setIsModalOpen(false);
      setReason("");
      setDetails("");
      onReported?.();
    } catch {
      showToast({
        variant: "error",
        title: t("feed.report.failed") || "Report Failed",
        message: t("feed.report.failedMessage") || "Failed to submit report. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        leftIcon={<Flag size={16} />}
        aria-label={t("feed.report.label") || "Report content"}
      >
        {t("feed.report.label") || "Report"}
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setReason("");
          setDetails("");
        }}
        title={t("feed.report.title") || "Report Content"}
        size="md"
      >
        <div className="flex flex--column flex--gap-lg">
          <p className="text-sm text-secondary">
            {t("feed.report.description") ||
              "Help us keep the community safe by reporting content that violates our guidelines."}
          </p>

          <Select
            label={t("feed.report.reason") || "Reason for Report"}
            options={reportReasons}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("feed.report.selectReason") || "Select a reason"}
            required
          />

          <Textarea
            label={t("feed.report.details") || "Additional Details (optional)"}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={
              t("feed.report.detailsPlaceholder") || "Provide any additional information"
            }
            rows={4}
            maxLength={500}
          />

          <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setReason("");
                setDetails("");
              }}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void handleSubmit();
              }}
              isLoading={isSubmitting}
              disabled={!reason}
            >
              {t("feed.report.submit") || "Submit Report"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
