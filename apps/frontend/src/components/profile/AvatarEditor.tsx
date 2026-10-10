import React, { useRef, useState } from "react";
import { Avatar, Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { deleteAvatar, uploadAvatar } from "../../services/api";

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  displayName: string;
  onChanged: () => unknown;
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
      const uploaded = await uploadAvatar(selectedFile, idempotencyKey);
      setSelectedFile(null);
      setPreviewUrl(uploaded.preview);
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
      setPreviewUrl(null);
      setSelectedFile(null);
      setIdempotencyKey(null);
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

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("settings.profile.avatarSelect")}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <div className="flex flex--gap-sm flex--wrap">
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

      {message ? <div role="status">{message}</div> : null}
    </div>
  );
};
