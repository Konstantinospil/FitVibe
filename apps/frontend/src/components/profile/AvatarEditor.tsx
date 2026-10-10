import React, { useRef, useState } from "react";
import { Avatar, Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { deleteAvatar, uploadAvatar } from "../../services/api";

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  displayName: string;
  onChanged: () => Promise<unknown> | unknown;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  currentAvatarUrl,
  displayName,
  onChanged,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setMessage(t("settings.profile.avatarInvalidType"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage(t("settings.profile.avatarTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
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
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
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
      await onChanged();
      setMessage(t("settings.profile.avatarDeleteSuccess"));
    } catch {
      setMessage(t("settings.profile.avatarDeleteError"));
    } finally {
      setBusy(false);
    }
  };

  const shownAvatar = previewUrl ?? currentAvatarUrl ?? undefined;
  const avatarName = displayName.trim() || t("settings.profile.avatarAlt");

  return (
    <div className="avatar-editor">
      <Avatar
        className="avatar-editor__preview"
        name={avatarName}
        src={shownAvatar}
        format={shownAvatar ? "photo" : "initials"}
        size="lg"
        statusDisplay="embedded"
        data-testid={shownAvatar ? "avatar-preview" : "avatar-placeholder"}
      />

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("settings.profile.avatarSelect")}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <div className="avatar-editor__actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {t("settings.profile.avatarSelect")}
        </Button>
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

      <p className="text-sm text-muted">{t("settings.profile.avatarHelp")}</p>
      {message ? <div role="status">{message}</div> : null}
    </div>
  );
};
