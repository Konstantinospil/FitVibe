import type React from "react";

/**
 * Contract between the scheduling hooks and the components that render a move
 * handle (`ScheduleSessionCard`, `ScheduleSessionChip`): the pointer-drag and
 * keyboard-move handlers a handle receives, and the attribute that identifies a
 * session's handle so focus can return to it after a move.
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
