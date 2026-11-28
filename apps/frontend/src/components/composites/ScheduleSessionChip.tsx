import type React from "react";
import { GripHorizontal } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import type { TrainingStatus } from "./TrainingSurface";
import {
  SCHEDULE_HANDLE_ATTRIBUTE,
  SCHEDULE_RESIZE_HANDLE_ATTRIBUTE,
  type ScheduleHandleProps,
} from "../../lib/scheduling/scheduleHandle";

export interface ScheduleSessionChipProps {
  /** Start and end, e.g. "18:00–19:30". */
  time: string;
  title: string;
  status: TrainingStatus;
  /** Accessible name of a movable chip; starts with the visible time and title (WCAG 2.5.3). */
  moveLabel?: string;
  moveHintId?: string;
  /** Drag and keyboard-move handlers; omitted for sessions that cannot move. */
  handleProps?: ScheduleHandleProps;
  handleId?: string;
  /** Opens the reschedule dialog (click, or Enter while not picked up). */
  onMove?: () => void;
  /** Accessible name of the resize handle, e.g. "Leg day, ends 19:30, change length". */
  resizeLabel?: string;
  resizeHintId?: string;
  /** Drag and keyboard handlers that change the session's end; omitted when it cannot change. */
  resizeHandleProps?: ScheduleHandleProps;
  conflictLabel?: string;
  /** Being dragged or picked up with the keyboard. */
  moving?: boolean;
  /** Its length is being changed. */
  resizing?: boolean;
}

/**
 * Compact session entry in the time-grid slot where the session starts. A
 * planned session's chip is itself the move handle: drag it to another slot,
 * press Space to pick it up with the keyboard, or click / press Enter to open
 * the reschedule dialog. Its resize handle changes when it ends the same ways.
 * Other sessions render as static labels in their status colours.
 */
const ScheduleSessionChip: React.FC<ScheduleSessionChipProps> = ({
  time,
  title,
  status,
  moveLabel,
  moveHintId,
  handleProps,
  handleId,
  onMove,
  resizeLabel,
  resizeHintId,
  resizeHandleProps,
  conflictLabel,
  moving = false,
  resizing = false,
}) => {
  const classes = [
    "schedule-chip",
    `schedule-chip--${status}`,
    conflictLabel ? "schedule-chip--conflict" : "",
    moving ? "schedule-chip--moving" : "",
    resizing ? "schedule-chip--resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="schedule-chip__time">{time}</span>
      <span className="schedule-chip__title">{title}</span>
      {conflictLabel ? <span className="schedule-chip__conflict">{conflictLabel}</span> : null}
    </>
  );

  if (!onMove) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <div className="schedule-chip-group">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        fullWidth
        {...handleProps}
        {...{ [SCHEDULE_HANDLE_ATTRIBUTE]: handleId }}
        className={`${classes} schedule-chip--movable`}
        aria-label={moveLabel}
        aria-describedby={moveHintId}
        onClick={onMove}
      >
        {content}
      </Button>
      {resizeHandleProps && resizeLabel ? (
        <IconButton
          {...resizeHandleProps}
          {...{ [SCHEDULE_RESIZE_HANDLE_ATTRIBUTE]: handleId }}
          className="schedule-chip__resize"
          icon={<GripHorizontal />}
          label={resizeLabel}
          aria-describedby={resizeHintId}
          size="sm"
          onClick={onMove}
        />
      ) : null}
    </div>
  );
};

/**
 * Marks a later hour slot that a session started earlier still occupies, so its
 * length is visible in the grid. Decorative: the chip already states the end time.
 */
export const ScheduleSessionContinuation: React.FC<{
  status: TrainingStatus;
  conflict?: boolean;
}> = ({ status, conflict = false }) => (
  <div
    aria-hidden="true"
    className={[
      "schedule-chip-continuation",
      `schedule-chip-continuation--${status}`,
      conflict ? "schedule-chip-continuation--conflict" : "",
    ]
      .filter(Boolean)
      .join(" ")}
  />
);

export default ScheduleSessionChip;
