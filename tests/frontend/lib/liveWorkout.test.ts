import { describe, expect, it } from "vitest";
import {
  activeSeconds,
  currentPosition,
  elapsedSeconds,
  fieldsFor,
  formatClock,
  nextPosition,
  restRemaining,
  summarize,
} from "../../../apps/frontend/src/lib/execution/liveWorkout";
import type {
  SessionExerciseSet,
  SessionWithExercises,
} from "../../../apps/frontend/src/services/sessionApi";

const set = (overrides: Partial<SessionExerciseSet>): SessionExerciseSet => ({
  id: "set",
  order_index: 1,
  status: "planned",
  source: "prescribed",
  planned: null,
  ...overrides,
});

const START = "2026-12-01T17:00:00.000Z";
const at = (seconds: number) => new Date(START).getTime() + seconds * 1000;

const session = (overrides: Partial<SessionWithExercises> = {}): SessionWithExercises => ({
  id: "session-1",
  owner_id: "user-1",
  planned_at: START,
  planned_duration_min: 60,
  status: "in_progress",
  visibility: "private",
  started_at: START,
  paused_at: null,
  paused_seconds: 0,
  exercises: [
    {
      id: "se-1",
      session_id: "session-1",
      exercise_name: "Back squat",
      order_index: 1,
      status: "planned",
      source: "prescribed",
      sets: [
        set({
          id: "a1",
          status: "completed",
          planned: { reps: 5, rest_sec: 90 },
          reps: 5,
          recorded_at: new Date(at(600)).toISOString(),
        }),
        set({ id: "a2", order_index: 2, planned: { reps: 5, weight_kg: 100 } }),
      ],
    },
    {
      id: "se-2",
      session_id: "session-1",
      exercise_name: "Lunge",
      order_index: 2,
      status: "skipped",
      source: "prescribed",
      sets: [set({ id: "b1" })],
    },
    {
      id: "se-3",
      session_id: "session-1",
      exercise_name: "Plank",
      order_index: 3,
      status: "planned",
      source: "added",
      sets: [set({ id: "c1", status: "skipped" }), set({ id: "c2", source: "added" })],
    },
  ],
  ...overrides,
});

describe("live workout position", () => {
  it("is the first set still planned, leaving out skipped exercises and sets", () => {
    const current = currentPosition(session());
    expect(current).toMatchObject({ set: { id: "a2" }, setNumber: 2, setCount: 2 });
    // se-2 is skipped and c1 is skipped, so the next set is c2.
    expect(nextPosition(session())).toMatchObject({ set: { id: "c2" }, setNumber: 2 });
  });

  it("is null when every set is recorded", () => {
    const done = session({ exercises: [] });
    expect(currentPosition(done)).toBeNull();
    expect(nextPosition(done)).toBeNull();
  });
});

describe("live workout fields", () => {
  it("asks for the metrics the set has a target for, in display order", () => {
    expect(fieldsFor(set({ planned: { weight_kg: 80, reps: 8 } })).map((f) => f.metric)).toEqual([
      "reps",
      "weight_kg",
    ]);
    expect(fieldsFor(set({ planned: { duration_sec: 60 } })).map((f) => f.metric)).toEqual([
      "duration_sec",
    ]);
  });

  it("asks for reps and load when the set has no target (rest alone is not one)", () => {
    expect(fieldsFor(set({ planned: { rest_sec: 60 } })).map((f) => f.metric)).toEqual([
      "reps",
      "weight_kg",
    ]);
    expect(fieldsFor(set({ planned: null })).map((f) => f.metric)).toEqual(["reps", "weight_kg"]);
  });
});

describe("live workout timers", () => {
  it("counts training time without finished or current pauses", () => {
    expect(elapsedSeconds(session(), at(1200))).toBe(1200);
    expect(activeSeconds(session({ paused_seconds: 200 }), at(1200))).toBe(1000);
    expect(
      activeSeconds(
        session({ paused_seconds: 200, paused_at: new Date(at(1100)).toISOString() }),
        at(1200),
      ),
    ).toBe(900);
  });

  it("is zero before the start and never negative", () => {
    expect(elapsedSeconds(session({ started_at: null }), at(100))).toBe(0);
    expect(activeSeconds(session({ paused_seconds: 5000 }), at(100))).toBe(0);
  });

  it("counts down the rest after the latest recorded set", () => {
    expect(restRemaining(session(), at(630))).toBe(60);
    expect(restRemaining(session(), at(700))).toBe(0);
  });

  it("uses the recorded rest before the target and ignores skipped sets", () => {
    const value = session();
    value.exercises[0].sets[0].rest_sec = 30;
    expect(restRemaining(value, at(610))).toBe(20);
    expect(restRemaining(session({ exercises: [{ ...value.exercises[2] }] }), at(610))).toBe(0);
  });

  it("formats minutes and seconds, and hours from one hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("0:00");
  });
});

describe("live workout summary", () => {
  it("counts done, skipped, open and added sets", () => {
    expect(summarize(session())).toEqual({
      completedSets: 1,
      skippedSets: 1,
      // b1 belongs to a skipped exercise, so it is not left to do.
      remainingSets: 2,
      addedSets: 1,
    });
  });
});
