import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, User } from "lucide-react";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { apiClient } from "../../services/api";

export interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onUploadSuccess?: (url: string) => void;
  onDeleteSuccess?: () => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  previewSize?: number;
}

/**
 * AvatarUpload component for uploading and managing user avatars.
 * Supports JPEG, PNG, and WebP formats with 128×128 preview.
 */
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  onUploadSuccess,
  onDeleteSuccess,
  onError,
  maxSizeMB = 5,
  previewSize = 128,
}) => {
  const { t } = useTranslation("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg =
        t("settings.profile.avatarInvalidType") ||
        `Invalid file type. Please use JPEG, PNG, or WebP.`;
      setAvatarError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg =
        t("settings.profile.avatarTooLarge") ||
        `File is too large. Maximum size is ${maxSizeMB}MB.`;
      setAvatarError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setAvatarError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.[0]) {
      const errorMsg = t("settings.profile.avatarNoFile") || "Please select a file to upload.";
      setAvatarError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const file = fileInput.files[0];
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await apiClient.post<{ fileUrl: string }>(
        "/api/v1/users/me/avatar",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data?.fileUrl) {
        setAvatarPreview(null);
        onUploadSuccess?.(response.data.fileUrl);
        // Reset file input
        if (fileInput) {
          fileInput.value = "";
        }
      }
    } catch (error) {
      const errorMessage =
        ((error as { response?: { data?: { error?: { message?: string; code?: string } } } })
          ?.response?.data?.error?.message ??
          t("settings.profile.avatarUploadError")) ||
        "Failed to upload avatar. Please try again.";
      setAvatarError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete("/api/v1/users/me/avatar");
      setAvatarPreview(null);
      onDeleteSuccess?.();
    } catch {
      const errorMessage =
        t("settings.profile.avatarDeleteError") || "Failed to delete avatar. Please try again.";
      setAvatarError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const displayUrl = avatarPreview || currentAvatarUrl;

  return (
    <div className="flex flex--column flex--gap-md">
      <label className="text-sm" style={{ fontWeight: 600 }}>
        {t("settings.profile.avatar") || "Profile Avatar"}
      </label>
      <div className="flex flex--align-center flex--gap-md" style={{ marginBottom: "0.75rem" }}>
        <div
          style={{
            width: `${previewSize}px`,
            height: `${previewSize}px`,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface)",
            flexShrink: 0,
          }}
        >
          {displayUrl ? (
            <img
              src={
                displayUrl.startsWith("http")
                  ? displayUrl
                  : `${apiClient.defaults.baseURL}${displayUrl}`
              }
              alt="Profile avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => {
                setAvatarError("Failed to load avatar image");
              }}
            />
          ) : (
            <User size={previewSize / 2} style={{ color: "var(--color-text-secondary)" }} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            id="avatar-upload"
          />
          <div className="flex flex--gap-sm" style={{ flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload size={16} />}
              disabled={uploadingAvatar}
            >
              {t("settings.profile.avatarSelect") || "Select Image"}
            </Button>
            {avatarPreview && (
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleUpload()}
                isLoading={uploadingAvatar}
                disabled={uploadingAvatar}
              >
                {t("settings.profile.avatarUpload") || "Upload"}
              </Button>
            )}
            {currentAvatarUrl && !avatarPreview && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                leftIcon={<X size={16} />}
                disabled={uploadingAvatar}
              >
                {t("settings.profile.avatarDelete") || "Delete"}
              </Button>
            )}
          </div>
          {avatarError && (
            <Alert variant="danger" style={{ marginTop: "0.5rem" }}>
              {avatarError}
            </Alert>
          )}
          <p className="text-sm" style={{ marginTop: "0.5rem", color: "var(--color-text-muted)" }}>
            {t("settings.profile.avatarHelp") ||
              `Upload a JPEG, PNG, or WebP image (max ${maxSizeMB}MB). Recommended size: ${previewSize}×${previewSize} pixels.`}
          </p>
        </div>
      </div>
    </div>
  );
};
