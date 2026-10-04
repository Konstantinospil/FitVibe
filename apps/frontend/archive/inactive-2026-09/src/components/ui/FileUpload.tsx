import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, File } from "lucide-react";
import { Button } from "./Button";
import { Alert } from "./Alert";

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  onFilesSelected?: (files: File[]) => void;
  onFileRemove?: (file: File) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  error?: string;
}

/**
 * FileUpload component with drag-and-drop support.
 * Provides file selection, preview, and removal functionality.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  onFilesSelected,
  onFileRemove,
  disabled = false,
  label,
  helperText,
  error,
}) => {
  const { t } = useTranslation("common");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return (
        t("fileUpload.fileTooLarge", {
          maxSize: `${(maxSize / 1024 / 1024).toFixed(1)}MB`,
        }) || `File is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(1)}MB`
      );
    }
    if (accept && !accept.split(",").some((type) => file.type.match(type.trim()))) {
      return t("fileUpload.invalidFileType") || "Invalid file type";
    }
    return null;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }

    const newFiles = Array.from(fileList);
    const errors: string[] = [];
    const validFiles: File[] = [];

    newFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setUploadError(errors.join(", "));
    } else {
      setUploadError(null);
    }

    if (validFiles.length > 0) {
      const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(updatedFiles);
      onFilesSelected?.(updatedFiles);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    const updatedFiles = files.filter((f) => f !== fileToRemove);
    setFiles(updatedFiles);
    onFileRemove?.(fileToRemove);
    if (updatedFiles.length === 0) {
      setUploadError(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const uploadAreaStyle: React.CSSProperties = {
    border: `2px dashed ${isDragging ? "var(--color-primary)" : "var(--color-border)"}`,
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-xl)",
    background: isDragging ? "rgba(159, 36, 6, 0.05)" : "var(--color-surface)",
    textAlign: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 150ms ease",
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <div className="flex flex--column flex--gap-md">
      {label && <label className="text-sm font-weight-600">{label}</label>}

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        style={uploadAreaStyle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("fileUpload.dropZone") || "Drop files here or click to select"}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          disabled={disabled}
          style={{ display: "none" }}
          aria-label={label || t("fileUpload.selectFiles") || "Select files"}
        />
        <Upload
          size={48}
          style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-md)" }}
        />
        <div className="flex flex--column flex--gap-sm">
          <p className="text-md font-weight-600 m-0">
            {t("fileUpload.dropFiles") || "Drop files here or click to select"}
          </p>
          {helperText && <p className="text-sm text-secondary m-0">{helperText}</p>}
          {accept && (
            <p className="text-xs text-secondary m-0">
              {t("fileUpload.acceptedTypes") || "Accepted types"}: {accept}
            </p>
          )}
          {maxSize && (
            <p className="text-xs text-secondary m-0">
              {t("fileUpload.maxSize") || "Max size"}: {formatFileSize(maxSize)}
            </p>
          )}
        </div>
      </div>

      {(error || uploadError) && <Alert variant="danger">{error || uploadError}</Alert>}

      {files.length > 0 && (
        <div className="flex flex--column flex--gap-sm">
          <h4 className="text-sm font-weight-600 m-0">
            {t("fileUpload.selectedFiles") || "Selected Files"} ({files.length})
          </h4>
          <div className="flex flex--column flex--gap-xs">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex flex--align-center flex--justify-between"
                style={{
                  padding: "var(--space-sm) var(--space-md)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div
                  className="flex flex--align-center flex--gap-sm"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <File size={20} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      className="text-sm font-weight-500 m-0"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {file.name}
                    </p>
                    <p className="text-xs text-secondary m-0">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file);
                  }}
                  aria-label={
                    t("fileUpload.removeFile", { name: file.name }) || `Remove ${file.name}`
                  }
                  leftIcon={<X size={16} />}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
