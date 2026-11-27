import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { TrainingPanel } from "./TrainingSurface";
import { FormActions, FormFeedback, FormStack, type FeedbackTone } from "./FormStack";
import { ConfirmDialog } from "../ConfirmDialog";
import { ResultNoteField } from "../domain/ResultNoteField";
import { WorkoutPhoto, WorkoutPhotoField } from "./WorkoutPhotoField";
import {
  deleteSessionPhoto,
  updateSession,
  uploadSessionPhoto,
  type SessionWithExercises,
} from "../../services/sessionApi";
import {
  PHOTO_MESSAGE_VALUES,
  PHOTO_PROBLEM_KEYS,
  photoUploadErrorKey,
  takePhotoUploadFailed,
} from "../../lib/sessions/workoutPhoto";

export interface SessionResultPanelProps {
  session: SessionWithExercises;
  isOwner: boolean;
  /** Stores the changed session wherever the page keeps it. */
  onChanged: (session: SessionWithExercises) => void;
}

type Feedback = { tone: FeedbackTone; text: string } | null;

/** The athlete's view and editor of a completed workout's note and photo. */
const OwnerResult: React.FC<Omit<SessionResultPanelProps, "isOwner">> = ({
  session,
  onChanged,
}) => {
  const { t } = useTranslation();
  const savedNote = session.result_note ?? "";
  const [note, setNote] = useState(savedNote);
  const [noteFeedback, setNoteFeedback] = useState<Feedback>(null);
  const [photoFeedback, setPhotoFeedback] = useState<Feedback>(() =>
    // Finishing saved the workout but could not upload its photo.
    takePhotoUploadFailed(session.id)
      ? { tone: "warning", text: t("workoutResult.photo.finishUploadFailed") }
      : null,
  );
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saveNote = useMutation({
    mutationFn: (value: string) => updateSession(session.id, { result_note: value.trim() || null }),
    onSuccess: (updated) => {
      onChanged(updated);
      setNote(updated.result_note ?? "");
      setNoteFeedback({ tone: "success", text: t("workoutResult.note.saved") });
    },
    onError: () => setNoteFeedback({ tone: "danger", text: t("workoutResult.note.saveError") }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadSessionPhoto(session.id, file),
    onSuccess: (photo) => {
      onChanged({ ...session, photo });
      setPhotoFeedback({ tone: "success", text: t("workoutResult.photo.added") });
    },
    onError: (error) =>
      setPhotoFeedback({
        tone: "danger",
        text: t(photoUploadErrorKey(error), PHOTO_MESSAGE_VALUES),
      }),
  });

  const remove = useMutation({
    mutationFn: () => deleteSessionPhoto(session.id),
    onSuccess: () => {
      onChanged({ ...session, photo: null });
      setPhotoFeedback({ tone: "success", text: t("workoutResult.photo.removed") });
    },
    onError: () => setPhotoFeedback({ tone: "danger", text: t("workoutResult.photo.removeError") }),
  });

  const photoBusy = upload.isPending || remove.isPending;

  return (
    <>
      <FormStack
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saveNote.mutate(note);
        }}
      >
        <ResultNoteField
          value={note}
          onChange={(value) => {
            setNote(value);
            setNoteFeedback(null);
          }}
          disabled={saveNote.isPending}
        />
        <FormActions>
          <Button type="submit" isLoading={saveNote.isPending} disabled={note === savedNote}>
            {t("workoutResult.note.save")}
          </Button>
        </FormActions>
        {noteFeedback ? (
          <FormFeedback tone={noteFeedback.tone}>{noteFeedback.text}</FormFeedback>
        ) : null}
      </FormStack>
      <WorkoutPhotoField
        src={session.photo?.url ?? null}
        busy={photoBusy}
        onSelect={(file) => {
          setPhotoFeedback({ tone: "info", text: t("workoutResult.photo.uploading") });
          upload.mutate(file);
        }}
        onReject={(problem) =>
          setPhotoFeedback({
            tone: "warning",
            text: t(PHOTO_PROBLEM_KEYS[problem], PHOTO_MESSAGE_VALUES),
          })
        }
        onRemove={() => setConfirmRemove(true)}
        feedback={photoFeedback}
      />
      <ConfirmDialog
        isOpen={confirmRemove}
        title={t("workoutResult.photo.removeTitle")}
        message={t("workoutResult.photo.removeMessage")}
        confirmLabel={t("workoutResult.photo.remove")}
        variant="danger"
        onConfirm={() => {
          setConfirmRemove(false);
          remove.mutate();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
};

/**
 * "How it went" on the session page (ADR-044). The owner of a completed workout
 * can write a note and add, replace or remove a photo; anyone else who may see
 * the session reads its note. Shown only when there is something to show or edit.
 */
export const SessionResultPanel: React.FC<SessionResultPanelProps> = ({
  session,
  isOwner,
  onChanged,
}) => {
  const { t } = useTranslation();
  const editable = isOwner && session.status === "completed";
  if (!editable && !session.result_note && !session.photo) {
    return null;
  }
  return (
    <TrainingPanel title={t("workoutResult.title")}>
      {editable ? (
        <OwnerResult session={session} onChanged={onChanged} />
      ) : (
        <>
          {session.result_note ? <p>{session.result_note}</p> : null}
          {session.photo ? <WorkoutPhoto src={session.photo.url} /> : null}
        </>
      )}
    </TrainingPanel>
  );
};
