import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
import { Modal } from "../ui/Modal";
import { deleteAccount } from "../../services/api";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

export interface AccountDeletionFormProps {
  onDeleted?: () => void;
}

/**
 * AccountDeletionForm component for account deletion with confirmation.
 * Implements GDPR-compliant account deletion flow.
 */
export const AccountDeletionForm: React.FC<AccountDeletionFormProps> = ({ onDeleted }) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requiredConfirmationText = t("settings.accountDeletion.confirmText") || "DELETE";

  const handleDelete = async () => {
    if (confirmationText !== requiredConfirmationText) {
      setError(
        t("settings.accountDeletion.confirmationMismatch") ||
          `Please type "${requiredConfirmationText}" to confirm`,
      );
      return;
    }

    if (!password) {
      setError(t("settings.accountDeletion.passwordRequired") || "Password is required");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await deleteAccount({ password });
      showToast({
        variant: "info",
        title: t("settings.accountDeletion.initiated") || "Account Deletion Initiated",
        message:
          t("settings.accountDeletion.scheduledMessage") ||
          `Your account will be deleted on ${new Date(response.scheduledAt).toLocaleDateString()}`,
      });
      setShowConfirmModal(false);
      // Sign out and redirect
      await signOut();
      void navigate("/login");
      onDeleted?.();
    } catch {
      setError(
        t("settings.accountDeletion.failed") ||
          "Failed to delete account. Please check your password.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle style={{ color: "var(--color-danger-text)" }}>
            {t("settings.accountDeletion.title") || "Delete Account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="danger" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="flex flex--align-center flex--gap-sm">
              <AlertTriangle size={20} />
              <div>
                <strong>
                  {t("settings.accountDeletion.warning") || "Warning: This action cannot be undone"}
                </strong>
                <p style={{ margin: "var(--space-xs) 0 0 0", fontSize: "var(--font-size-sm)" }}>
                  {t("settings.accountDeletion.description") ||
                    "Deleting your account will permanently remove all your data, including sessions, exercises, and progress. This action is irreversible."}
                </p>
              </div>
            </div>
          </Alert>

          <div className="flex flex--column flex--gap-md">
            <p style={{ color: "var(--color-text-muted)" }}>
              {t("settings.accountDeletion.gdprInfo") ||
                "According to GDPR, you have the right to request deletion of your personal data. Your account will be scheduled for deletion with a 14-day grace period."}
            </p>

            <Button variant="danger" onClick={() => setShowConfirmModal(true)}>
              {t("settings.accountDeletion.deleteAccount") || "Delete My Account"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPassword("");
          setConfirmationText("");
          setError(null);
        }}
        title={t("settings.accountDeletion.confirmTitle") || "Confirm Account Deletion"}
        size="md"
      >
        <div className="flex flex--column flex--gap-lg">
          <Alert variant="danger">
            {t("settings.accountDeletion.finalWarning") ||
              "This action cannot be undone. All your data will be permanently deleted."}
          </Alert>

          {error && <Alert variant="danger">{error}</Alert>}

          <Input
            label={t("settings.accountDeletion.passwordLabel") || "Enter your password to confirm"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div>
            <label style={{ display: "block", marginBottom: "var(--space-xs)", fontWeight: 500 }}>
              {t("settings.accountDeletion.confirmationLabel") ||
                `Type "${requiredConfirmationText}" to confirm`}
            </label>
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={requiredConfirmationText}
              style={{
                fontFamily: "var(--font-family-mono)",
                textTransform: "uppercase",
              }}
            />
          </div>

          <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={() => {
                setShowConfirmModal(false);
                setPassword("");
                setConfirmationText("");
                setError(null);
              }}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void handleDelete();
              }}
              isLoading={isDeleting}
              disabled={confirmationText !== requiredConfirmationText || !password}
            >
              {t("settings.accountDeletion.confirmDelete") || "Delete Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
