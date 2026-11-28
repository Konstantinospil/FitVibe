import type React from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { TrainingSummaryCard } from "./TrainingSurface";
import {
  SCHEDULE_HANDLE_ATTRIBUTE,
  type ScheduleHandleProps,
} from "../../lib/scheduling/scheduleHandle";

export interface ScheduleSessionCardProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  supporting?: React.ReactNode;
  /** Accessible name of the move handle, e.g. "Move Leg day". */
  moveLabel: string;
  /** Id of the element that explains how the handle works. */
  moveHintId?: string;
  /** Drag and keyboard-move handlers; omitted for sessions that cannot move. */
  handleProps?: ScheduleHandleProps;
  /** Session id, exposed on the handle so focus can return to it after a move. */
  handleId?: string;
  /** Opens the non-drag move dialog (click, Enter or Space on the handle). */
  onMove?: () => void;
  onDetails?: () => void;
  detailsLabel?: string;
  /** Visible label shown when the session takes part in a schedule conflict. */
  conflictLabel?: string;
  /** Being dragged or picked up with the keyboard. */
  dragging?: boolean;
}

/**
 * A planned session that can be rescheduled: the standard training summary card with
 * one move handle. Dragging the handle moves the session; activating it without
 * dragging opens the move dialog, so every move has a keyboard path.
 */
const ScheduleSessionCard: React.FC<ScheduleSessionCardProps> = ({
  title,
  meta,
  supporting,
  moveLabel,
  moveHintId,
  handleProps,
  handleId,
  onMove,
  onDetails,
  detailsLabel,
  conflictLabel,
  dragging = false,
}) => {
  const movable = Boolean(onMove);
  const classes = [
    "schedule-session-card",
    conflictLabel ? "schedule-session-card--conflict" : "",
    dragging ? "schedule-session-card--dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TrainingSummaryCard
      className={classes}
      title={title}
      meta={meta}
      supporting={
        conflictLabel ? (
          <>
            {supporting}
            <span className="schedule-session-card__conflict">{conflictLabel}</span>
          </>
        ) : (
          supporting
        )
      }
      trailing={
        <>
          {onDetails ? (
            <Button size="sm" variant="secondary" onClick={onDetails}>
              {detailsLabel}
            </Button>
          ) : null}
          {movable ? (
            <IconButton
              {...handleProps}
              {...{ [SCHEDULE_HANDLE_ATTRIBUTE]: handleId }}
              className="schedule-session-card__handle"
              icon={<GripVertical />}
              label={moveLabel}
              size="sm"
              aria-describedby={moveHintId}
              onClick={onMove}
            />
          ) : null}
        </>
      }
    />
  );
};

export interface ScheduleDragPreviewProps {
  title: React.ReactNode;
  /** Callback ref from `usePointerDrag`; it positions the preview under the pointer. */
  previewRef: (element: HTMLElement | null) => void;
}

/**
 * Visual-only label that follows the pointer while a session is dragged. It is
 * rendered into the document body so scroll containers cannot clip it, and it is
 * hidden from assistive technology (the move outcome is announced instead).
 */
export const ScheduleDragPreview: React.FC<ScheduleDragPreviewProps> = ({ title, previewRef }) =>
  createPortal(
    <div ref={previewRef} className="schedule-drag-preview" aria-hidden="true">
      <GripVertical />
      <span>{title}</span>
    </div>,
    document.body,
  );

export default ScheduleSessionCard;
