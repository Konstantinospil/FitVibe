import type React from "react";
import { useState } from "react";
import { Avatar, Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { deleteAvatar, uploadAvatar } from "../../services/api";
import { ImageFilePicker } from "../composites/ImageFilePicker";
import { readImagePreview, type ImageFileProblem } from "../../lib/media/imageFile";

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  displayName: string;
  username: string;
  onChanged: () => unknown;
}

const PROBLEM_KEYS: Record<ImageFileProblem, string> = {
  invalidType: "settings.profile.avatarInvalidType",
  tooLarge: "settings.profile.avatarTooLarge",
};

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  currentAvatarUrl,
  displayName,
  username,
  onChanged,
}) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIdempotencyKey(null);
  };

  // A rejected new selection must never leave an older file uploadable.
  const rejectFile = (problem: ImageFileProblem) => {
    clearSelection();
    setMessage(t(PROBLEM_KEYS[problem]));
  };

  const selectFile = (file: File) => {
    clearSelection();
    readImagePreview(file).then(setPreviewUrl, () => setPreviewUrl(null));
    setSelectedFile(file);
    setIdempotencyKey(crypto.randomUUID());
    setMessage(null);
  };

  const save = async () => {
    if (!selectedFile || !idempotencyKey) {
      setMessage(t("settings.profile.avatarNoFile"));
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await uploadAvatar(selectedFile, idempotencyKey);
      // Use the persisted profile URL, not an inline preview that can outlive a
      // failed refresh or differ from the server's authoritative image.
      clearSelection();
      await onChanged();
      setMessage(t("settings.profile.avatarUploadSuccess"));
    } catch {
      setMessage(t("settings.profile.avatarUploadError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await deleteAvatar();
      clearSelection();
      await onChanged();
      setMessage(t("settings.profile.avatarDeleteSuccess"));
    } catch {
      setMessage(t("settings.profile.avatarDeleteError"));
    } finally {
      setBusy(false);
    }
  };

  const shownAvatar = previewUrl ?? currentAvatarUrl ?? undefined;
  const avatarName = displayName.trim() || username.trim();

  return (
    <div className="grid grid--gap-md" aria-labelledby="avatar-editor-title">
      <div className="flex flex--align-center flex--gap-md flex--wrap">
        <Avatar
          name={avatarName}
          src={shownAvatar}
          format={shownAvatar ? "photo" : "initials"}
          size="lg"
          status="unknown"
          data-testid={shownAvatar ? "avatar-preview" : "avatar-placeholder"}
        />

        <div className="grid grid--gap-xs">
          <p id="avatar-editor-title" className="form-label-text m-0">
            {t("settings.profile.avatar")}
          </p>
          <p className="text-sm text-muted m-0">{t("settings.profile.avatarHelp")}</p>
        </div>
      </div>

      <div className="flex flex--gap-sm flex--wrap">
        <ImageFilePicker
          label={t("settings.profile.avatarSelect")}
          onSelect={selectFile}
          onReject={rejectFile}
          disabled={busy}
        />
        {selectedFile ? (
          <Button type="button" onClick={() => void save()} isLoading={busy}>
            {t("settings.profile.avatarUpload")}
          </Button>
        ) : null}
        {currentAvatarUrl && !selectedFile ? (
          <Button type="button" variant="danger" onClick={() => void remove()} disabled={busy}>
            {t("settings.profile.avatarDelete")}
          </Button>
        ) : null}
      </div>

      {message ? <div role="status">{message}</div> : null}
    </div>
  );
};
