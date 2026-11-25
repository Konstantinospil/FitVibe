import React from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { IconButton } from "@fitvibe/ui";
import { TrainingSummaryCard } from "./TrainingSurface";

export type ScheduleHandleProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onClickCapture"
>;

export interface ScheduleSessionCardProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  supporting?: React.ReactNode;
  /** Accessible name of the move handle, e.g. "Move Leg day". */
  moveLabel: string;
  /** Id of the element that explains how the handle works. */
  moveHintId?: string;
  /** Pointer handlers from `usePointerDrag`; omitted for sessions that cannot move. */
  handleProps?: ScheduleHandleProps;
  /** Opens the non-drag move dialog (click, Enter or Space on the handle). */
  onMove?: () => void;
  /** Visible label shown when the session takes part in a schedule conflict. */
  conflictLabel?: string;
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
  onMove,
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
        movable ? (
          <IconButton
            {...handleProps}
            className="schedule-session-card__handle"
            icon={<GripVertical />}
            label={moveLabel}
            size="sm"
            aria-describedby={moveHintId}
            onClick={onMove}
          />
        ) : undefined
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
