import type React from "react";

/**
 * Contract between the scheduling hooks and the components that render a move
 * or resize handle (`ScheduleSessionCard`, `ScheduleSessionChip`): the
 * pointer-drag and keyboard handlers a handle receives, and the attributes that
 * identify a session's handles so focus can return to them after a change.
 */
export type ScheduleHandleProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onClickCapture"
  | "onKeyDown"
  | "onKeyUp"
  | "onBlur"
>;

export const SCHEDULE_HANDLE_ATTRIBUTE = "data-schedule-handle";

/** Marks the handle that changes a session's length (week and day views). */
export const SCHEDULE_RESIZE_HANDLE_ATTRIBUTE = "data-schedule-resize";
