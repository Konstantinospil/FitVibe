/**
 * Scheduling rules for planned sessions.
 *
 * A planned session occupies the half-open interval
 * `[planned_at, planned_at + planned_duration_min)`. Two sessions conflict when
 * their intervals overlap; back-to-back sessions (one ends when the next starts)
 * do not. Canceled and deleted sessions occupy no time.
 */

/** Bounds of `sessions.planned_duration_min`; the database enforces the same range. */
export const SESSION_DURATION_LIMITS = { min: 5, max: 720 } as const;

/** Length given to a session when none is planned; matches the column default. */
export const DEFAULT_SESSION_DURATION_MIN = 60;

const MINUTE_MS = 60_000;

export interface ScheduleWindow {
  /** ISO instant the session starts. */
  start: string;
  durationMin: number;
}

export const windowBounds = ({ start, durationMin }: ScheduleWindow): [number, number] => {
  const startMs = new Date(start).getTime();
  return [startMs, startMs + durationMin * MINUTE_MS];
};

export const windowsOverlap = (a: ScheduleWindow, b: ScheduleWindow): boolean => {
  const [aStart, aEnd] = windowBounds(a);
  const [bStart, bEnd] = windowBounds(b);
  return aStart < bEnd && bStart < aEnd;
};

/** Index pairs of windows in one batch that overlap each other. */
export const overlappingPairs = (windows: readonly ScheduleWindow[]): Array<[number, number]> => {
  const order = windows
    .map((window, index) => ({ index, bounds: windowBounds(window) }))
    .sort((a, b) => a.bounds[0] - b.bounds[0]);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < order.length; i += 1) {
    for (let j = i + 1; j < order.length && order[j].bounds[0] < order[i].bounds[1]; j += 1) {
      pairs.push([order[i].index, order[j].index]);
    }
  }
  return pairs;
};
