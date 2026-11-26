import React from "react";
import { Button } from "@fitvibe/ui";

export type CalendarView = "month" | "week" | "day";

export const CALENDAR_VIEWS: readonly CalendarView[] = ["month", "week", "day"];

export interface CalendarViewSwitchProps {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
  /** Accessible name of the group, e.g. "Calendar view". */
  label: string;
  /** Visible label per view. */
  viewLabel: (view: CalendarView) => string;
}

/**
 * Toggle-button group that switches between month, week and day views.
 * The active view is the pressed button (`aria-pressed`), so the state is
 * exposed without relying on the button's colour.
 */
const CalendarViewSwitch: React.FC<CalendarViewSwitchProps> = ({
  view,
  onChange,
  label,
  viewLabel,
}) => (
  <div className="calendar-view-switch" role="group" aria-label={label}>
    {CALENDAR_VIEWS.map((option) => (
      <Button
        key={option}
        type="button"
        size="sm"
        variant={option === view ? "primary" : "secondary"}
        aria-pressed={option === view}
        onClick={() => onChange(option)}
      >
        {viewLabel(option)}
      </Button>
    ))}
  </div>
);

export default CalendarViewSwitch;
