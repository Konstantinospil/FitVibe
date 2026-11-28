import type React from "react";
import { useState } from "react";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  localDateKey,
  localDateTimeToIso,
  localTimeKey,
  SESSION_DURATION_LIMITS,
} from "../../lib/scheduling/sessionSchedule";
import type { SessionSchedule } from "../../hooks/useSessionReschedule";
import { FormFeedback, FormStack } from "./FormStack";
import { Modal } from "./Modal";
import { Section } from "./Section";

export interface RescheduleSessionDialogProps {
  sessionTitle: string;
  plannedAt: string;
  /** Planned length in minutes. */
  durationMin: number;
  onCancel: () => void;
  /**
   * Saves the new start and length. Resolves to null when saved, or to the
   * message to show when it was refused (for example an overlapping session).
   */
  onConfirm: (schedule: SessionSchedule) => Promise<string | null>;
}

/**
 * Non-drag way to reschedule and resize a session (WCAG 2.5.7 dragging
 * alternative): pick a day, a start time and a length. Mount it with a `key`
 * per session so its draft starts fresh.
 */
const RescheduleSessionDialog: React.FC<RescheduleSessionDialogProps> = ({
  sessionTitle,
  plannedAt,
  durationMin,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [day, setDay] = useState(() => localDateKey(plannedAt));
  const [time, setTime] = useState(() => localTimeKey(plannedAt));
  const [length, setLength] = useState(() => String(durationMin));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    const target = localDateTimeToIso(day, time);
    if (!target) {
      setMessage(t("calendarSurface.schedule.errors.invalid"));
      return;
    }
    const minutes = Number(length);
    if (
      !Number.isInteger(minutes) ||
      minutes < SESSION_DURATION_LIMITS.min ||
      minutes > SESSION_DURATION_LIMITS.max
    ) {
      setMessage(
        t("calendarSurface.schedule.errors.invalidDuration", {
          min: SESSION_DURATION_LIMITS.min,
          max: SESSION_DURATION_LIMITS.max,
        }),
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    const refusal = await onConfirm({ plannedAt: target, durationMin: minutes });
    setSaving(false);
    if (refusal) {
      setMessage(refusal);
    }
  };

  const dismiss = () => {
    if (!saving) {
      onCancel();
    }
  };

  return (
    <Modal
      open
      width="sm"
      title={t("calendarSurface.schedule.dialog.title")}
      description={t("calendarSurface.schedule.dialog.description", { title: sessionTitle })}
      closeLabel={t("calendarSurface.schedule.actions.cancel")}
      onClose={dismiss}
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={dismiss}>
            {t("calendarSurface.schedule.actions.cancel")}
          </Button>
          <Button type="submit" form="reschedule-session-form" isLoading={saving}>
            {t("calendarSurface.schedule.actions.save")}
          </Button>
        </>
      }
    >
      <Section>
        <FormStack id="reschedule-session-form" onSubmit={(event) => void submit(event)}>
          {message ? <FormFeedback tone="warning">{message}</FormFeedback> : null}
          <label className="form-label">
            <span className="form-label-text">{t("calendarSurface.schedule.fields.day")}</span>
            <InputControl
              type="date"
              value={day}
              required
              disabled={saving}
              onChange={(event) => {
                setDay(event.target.value);
                setMessage(null);
              }}
            />
          </label>
          <label className="form-label">
            <span className="form-label-text">{t("calendarSurface.schedule.fields.time")}</span>
            <InputControl
              type="time"
              value={time}
              required
              disabled={saving}
              onChange={(event) => {
                setTime(event.target.value);
                setMessage(null);
              }}
            />
          </label>
          <label className="form-label">
            <span className="form-label-text">{t("calendarSurface.schedule.fields.duration")}</span>
            <InputControl
              type="number"
              inputMode="numeric"
              min={SESSION_DURATION_LIMITS.min}
              max={SESSION_DURATION_LIMITS.max}
              value={length}
              required
              disabled={saving}
              onChange={(event) => {
                setLength(event.target.value);
                setMessage(null);
              }}
            />
          </label>
        </FormStack>
      </Section>
    </Modal>
  );
};

export default RescheduleSessionDialog;
