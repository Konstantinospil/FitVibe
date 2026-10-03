import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { createShareLink, revokeShareLink } from "../../services/api";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";

export interface ShareButtonProps {
  feedItemId: string;
  sessionId?: string;
  shareUrl?: string;
  onShareLinkCreated?: (url: string) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
}

/**
 * ShareButton component for sharing feed items.
 * Creates shareable links and allows copying to clipboard.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  feedItemId,
  sessionId: _sessionId,
  shareUrl: initialShareUrl,
  onShareLinkCreated,
  size = "md",
  variant = "default",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>(initialShareUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) {
      return;
    }

    setIsModalOpen(true);

    // If we don't have a share URL yet, create one
    if (!shareUrl) {
      setIsLoading(true);
      try {
        const response = await createShareLink(feedItemId);
        const fullUrl = response.url || `${window.location.origin}/feed/link/${response.token}`;
        setShareUrl(fullUrl);
        onShareLinkCreated?.(fullUrl);
      } catch {
        showToast({
          variant: "error",
          title: t("feed.share.error.title"),
          message: t("feed.share.error.message"),
        });
        setIsModalOpen(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) {
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast({
        variant: "success",
        title: t("feed.share.copied"),
      });
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      showToast({
        variant: "error",
        title: t("feed.share.copyError"),
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareUrl) {
      return;
    }

    setIsLoading(true);
    try {
      await revokeShareLink(feedItemId);
      setShareUrl(undefined);
      showToast({
        variant: "info",
        title: t("feed.share.revoked"),
      });
      setIsModalOpen(false);
    } catch {
      showToast({
        variant: "error",
        title: t("feed.share.revokeError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyle: React.CSSProperties =
    variant === "minimal"
      ? {
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: "0.5rem",
          minWidth: "auto",
        }
      : {};

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={(e) => {
          void handleClick(e);
        }}
        isLoading={isLoading}
        leftIcon={
          <Share2
            style={{
              width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
              height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            }}
          />
        }
        style={buttonStyle}
        aria-label={t("feed.share.share")}
      >
        {variant === "default" && t("feed.share.share")}
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("feed.share.title")}
        description={t("feed.share.description")}
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {isLoading ? (
            <div style={{ padding: "var(--space-lg)", textAlign: "center" }}>
              {t("feed.share.creating")}
            </div>
          ) : shareUrl ? (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-sm)",
                  alignItems: "center",
                  padding: "var(--space-md)",
                  background: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    padding: "var(--space-sm)",
                    background: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-family-mono)",
                  }}
                  aria-label={t("feed.share.urlLabel")}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    void handleCopy();
                  }}
                  isLoading={isCopying}
                  leftIcon={copied ? <Check /> : <Copy />}
                  aria-label={copied ? t("feed.share.copied") : t("feed.share.copy")}
                >
                  {copied ? t("feed.share.copied") : t("feed.share.copy")}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void handleRevoke();
                }}
                isLoading={isLoading}
              >
                {t("feed.share.revoke")}
              </Button>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
};
