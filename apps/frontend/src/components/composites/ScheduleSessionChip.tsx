import React from "react";
import { Button } from "@fitvibe/ui";
import type { TrainingStatus } from "./TrainingSurface";
import {
  SCHEDULE_HANDLE_ATTRIBUTE,
  type ScheduleHandleProps,
} from "../../lib/scheduling/scheduleHandle";

export interface ScheduleSessionChipProps {
  time: string;
  title: string;
  status: TrainingStatus;
  /** Accessible name of a movable chip; starts with the visible time and title (WCAG 2.5.3). */
  moveLabel?: string;
  moveHintId?: string;
  /** Drag and keyboard-move handlers; omitted for sessions that cannot move. */
  handleProps?: ScheduleHandleProps;
  handleId?: string;
  /** Opens the move dialog (click, or Enter while not picked up). */
  onMove?: () => void;
  conflictLabel?: string;
  /** Being dragged or picked up with the keyboard. */
  moving?: boolean;
}

/**
 * Compact session entry inside a time-grid slot. A planned session's chip is
 * itself the move handle: drag it to another slot, press Space to pick it up
 * with the keyboard, or click / press Enter to open the move dialog. Other
 * sessions render as static labels in their status colours.
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
  conflictLabel,
  moving = false,
}) => {
  const classes = [
    "schedule-chip",
    `schedule-chip--${status}`,
    conflictLabel ? "schedule-chip--conflict" : "",
    moving ? "schedule-chip--moving" : "",
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
  );
};

export default ScheduleSessionChip;
