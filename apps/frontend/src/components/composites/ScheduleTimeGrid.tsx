import React from "react";
import { slotKey } from "../../lib/scheduling/sessionSchedule";

export interface ScheduleSlotState {
  /** A dragged or keyboard-moved session would land here. */
  dropTarget: boolean;
  /** The slot holds a session that conflicts with the pending move. */
  conflict: boolean;
}

export interface ScheduleTimeGridProps {
  /** Local day keys (`YYYY-MM-DD`) shown as columns: seven for a week, one for a day. */
  days: readonly string[];
  /** Hours (0–23) shown as rows. */
  hours: readonly number[];
  label: string;
  /** Header of the hour column, e.g. "Time" (visually hidden). */
  timeHeading: string;
  dayHeading: (dayKey: string) => React.ReactNode;
  hourLabel: (hour: number) => string;
  /** Sessions planned in a slot, already rendered (for example as `ScheduleSessionChip`s). */
  renderSlot: (dayKey: string, hour: number) => React.ReactNode;
  slotState: (dayKey: string, hour: number) => ScheduleSlotState;
  /** Attribute that marks slots as drop targets; its value is the slot key. */
  dropTargetAttribute: string;
}

/**
 * Week and day calendar views: hour rows by day columns. Each slot is a drop
 * target keyed `YYYY-MM-DDTHH`. Structured as a table (column headers are days,
 * row headers are hours) so screen readers can relate every session to its day
 * and time.
 */
const ScheduleTimeGrid: React.FC<ScheduleTimeGridProps> = ({
  days,
  hours,
  label,
  timeHeading,
  dayHeading,
  hourLabel,
  renderSlot,
  slotState,
  dropTargetAttribute,
}) => (
  <div className="schedule-time-grid__scroll">
    <div className="schedule-time-grid" role="table" aria-label={label} data-days={days.length}>
      <div className="schedule-time-grid__row" role="row">
        <div className="schedule-time-grid__corner" role="columnheader">
          <span className="sr-only">{timeHeading}</span>
        </div>
        {days.map((day) => (
          <div className="schedule-time-grid__day" role="columnheader" key={day}>
            {dayHeading(day)}
          </div>
        ))}
      </div>
      {hours.map((hour) => (
        <div className="schedule-time-grid__row" role="row" key={hour}>
          <div className="schedule-time-grid__hour" role="rowheader">
            {hourLabel(hour)}
          </div>
          {days.map((day) => {
            const key = slotKey(day, hour);
            const state = slotState(day, hour);
            return (
              <div
                key={key}
                role="cell"
                className={[
                  "schedule-time-grid__slot",
                  state.dropTarget ? "schedule-time-grid__slot--drop-target" : "",
                  state.conflict ? "schedule-time-grid__slot--conflict" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...{ [dropTargetAttribute]: key }}
              >
                {renderSlot(day, hour)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);

export default ScheduleTimeGrid;
