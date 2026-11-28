import type React from "react";
import { useRef } from "react";
import { Button, type ButtonProps } from "@fitvibe/ui";
import {
  IMAGE_FILE_ACCEPT,
  imageFileProblem,
  type ImageFileProblem,
} from "../../lib/media/imageFile";

export interface ImageFilePickerProps {
  /** The button text; also the file input's accessible name. */
  label: string;
  /** A file that passed the type and size checks. */
  onSelect: (file: File) => void;
  /** A file the server would refuse; it is not passed on. */
  onReject: (problem: ImageFileProblem) => void;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  name?: string;
}

/**
 * A button that opens the file chooser for one image (JPEG, PNG or WebP within the
 * upload size). The native input stays in the page for forms and tests, but hidden.
 */
export const ImageFilePicker: React.FC<ImageFilePickerProps> = ({
  label,
  onSelect,
  onReject,
  disabled,
  variant = "secondary",
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (file: File | undefined) => {
    // Clear the input so choosing the same file again still reports a change.
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (!file) {
      return;
    }
    const problem = imageFileProblem(file);
    if (problem) {
      onReject(problem);
      return;
    }
    onSelect(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        name={name}
        accept={IMAGE_FILE_ACCEPT}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
};
