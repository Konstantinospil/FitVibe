import type {
  SessionExercise,
  SessionExerciseSet,
  SessionWithExercises,
} from "../../services/sessionApi";
import { SET_METRIC_FIELDS, type SetMetricField } from "../forms/setMetrics";

/**
 * Pure rules for the live workout screen (ADR-043). The server owns order and
 * state; these helpers only read the session it returned.
 */

export const liveWorkoutPath = (sessionId: string) => `/start/${sessionId}`;

export const liveSessionQueryKey = (sessionId: string) => ["live-session", sessionId] as const;

/** Fields shown when a set has no target: repetitions with load. */
const DEFAULT_FIELDS = SET_METRIC_FIELDS.filter(
  ({ metric }) => metric === "reps" || metric === "weight_kg",
);

export interface LivePosition {
  exercise: SessionExercise;
  set: SessionExerciseSet;
  /** 1-based position of the set within its exercise. */
  setNumber: number;
  setCount: number;
}

const isOpen = (set: SessionExerciseSet) => set.status === "planned";

/** Every set still to do, in the server's order; skipped exercises are left out. */
export function openPositions(session: SessionWithExercises): LivePosition[] {
  return session.exercises
    .filter((exercise) => exercise.status !== "skipped")
    .flatMap((exercise) =>
      exercise.sets.flatMap((set, index) =>
        isOpen(set)
          ? [{ exercise, set, setNumber: index + 1, setCount: exercise.sets.length }]
          : [],
      ),
    );
}

/** The set to record now, or null when nothing is left. */
export function currentPosition(session: SessionWithExercises): LivePosition | null {
  return openPositions(session)[0] ?? null;
}

/** The set after the current one, to prepare for. */
export function nextPosition(session: SessionWithExercises): LivePosition | null {
  return openPositions(session)[1] ?? null;
}

/**
 * Fields to record for a set: those it has a target for (or reps and load), then
 * the optional results every set offers, such as heart rate.
 */
export function fieldsFor(set: SessionExerciseSet): readonly SetMetricField[] {
  const targeted = SET_METRIC_FIELDS.filter(
    ({ metric, resultOnly }) =>
      !resultOnly &&
      metric !== "heart_rate_bpm" &&
      set.planned?.[metric] !== null &&
      set.planned?.[metric] !== undefined,
  );
  const resultOnly = SET_METRIC_FIELDS.filter((field) => field.resultOnly);
  return [...(targeted.length > 0 ? targeted : DEFAULT_FIELDS), ...resultOnly];
}

const secondsSince = (value: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));

/** Wall-clock time since the start, in seconds. */
export function elapsedSeconds(session: SessionWithExercises, now: number): number {
  if (!session.started_at) {
    return 0;
  }
  const end = session.completed_at ? new Date(session.completed_at).getTime() : now;
  return secondsSince(session.started_at, end);
}

/** Elapsed time without pauses, derived from the server's timestamps. */
export function activeSeconds(session: SessionWithExercises, now: number): number {
  const openPause = session.paused_at ? secondsSince(session.paused_at, now) : 0;
  return Math.max(0, elapsedSeconds(session, now) - (session.paused_seconds ?? 0) - openPause);
}

/** Seconds of rest left after the most recently recorded set, or 0. */
export function restRemaining(session: SessionWithExercises, now: number): number {
  let latest: SessionExerciseSet | null = null;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.status === "completed" && set.recorded_at) {
        if (!latest || new Date(set.recorded_at) > new Date(latest.recorded_at!)) {
          latest = set;
        }
      }
    }
  }
  const rest = latest ? (latest.rest_sec ?? latest.planned?.rest_sec ?? 0) : 0;
  if (!latest || rest <= 0) {
    return 0;
  }
  return Math.max(0, rest - secondsSince(latest.recorded_at!, now));
}

/** `m:ss`, or `h:mm:ss` from one hour. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export interface WorkoutSummary {
  completedSets: number;
  skippedSets: number;
  remainingSets: number;
  addedSets: number;
}

export function summarize(session: SessionWithExercises): WorkoutSummary {
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  return {
    completedSets: sets.filter((set) => set.status === "completed").length,
    skippedSets: sets.filter((set) => set.status === "skipped").length,
    remainingSets: openPositions(session).length,
    addedSets: sets.filter((set) => set.source === "added").length,
  };
}
