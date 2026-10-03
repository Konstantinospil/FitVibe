import {
  estimateSessionComposition,
  type ExerciseEstimationInput,
} from "../../../../apps/backend/src/modules/sessions/sessions.estimation.service.js";
import type { SessionWithExercises } from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

const baseSession = (exercises: SessionWithExercises["exercises"]): SessionWithExercises => ({
  id: "session-1",
  owner_id: "user-1",
  planned_at: "2026-10-04T10:00:00.000Z",
  status: "planned",
  visibility: "private",
  exercises,
});

const inputMap = (...inputs: ExerciseEstimationInput[]) =>
  new Map(inputs.map((input) => [input.id, input]));

describe("session estimation", () => {
  it("estimates rep-only work from exercise-specific seconds per rep", () => {
    const session = baseSession([
      {
        id: "se-1",
        session_id: "session-1",
        exercise_id: "ex-1",
        order_index: 1,
        planned: { sets: 3, reps: 10, rest: "00:01:00" },
        sets: [],
      },
    ]);

    const estimate = estimateSessionComposition(
      session,
      inputMap({ id: "ex-1", metValue: 6, secondsPerRep: 2 }),
      70,
    );

    expect(estimate.activeDurationSec).toBe(60);
    expect(estimate.restDurationSec).toBe(120);
    expect(estimate.minimumTotalDurationSec).toBe(180);
    expect(estimate.normalizedMet).toBe(6);
    expect(estimate.estimatedKcalPerMin).toBe(7.35);
    expect(estimate.complete).toBe(true);
  });

  it("uses explicit duration and counts configured rest exactly once", () => {
    const session = baseSession([
      {
        id: "se-1",
        session_id: "session-1",
        exercise_id: "ex-1",
        order_index: 1,
        planned: { extras: { rest_after_exercise_sec: 30 } },
        sets: [
          { id: "s1", order_index: 1, duration_sec: 40, rest_sec: 20 },
          { id: "s2", order_index: 2, duration_sec: 50, rest_sec: 999 },
        ],
      },
      {
        id: "se-2",
        session_id: "session-1",
        exercise_id: "ex-2",
        order_index: 2,
        planned: null,
        sets: [{ id: "s3", order_index: 1, duration_sec: 60, rest_sec: 999 }],
      },
    ]);

    const estimate = estimateSessionComposition(
      session,
      inputMap(
        { id: "ex-1", metValue: 5, secondsPerRep: null },
        { id: "ex-2", metValue: 8, secondsPerRep: null },
      ),
      null,
    );

    expect(estimate.activeDurationSec).toBe(150);
    expect(estimate.restDurationSec).toBe(50);
    expect(estimate.minimumTotalDurationSec).toBe(200);
    expect(estimate.normalizedMet).toBe(6.2);
    expect(estimate.estimatedKcalPerMin).toBeNull();
    expect(estimate.missingInputs).toContain("athlete:weight_kg");
  });

  it("returns an explicit incomplete result when rep timing is missing", () => {
    const session = baseSession([
      {
        id: "se-1",
        session_id: "session-1",
        exercise_id: "ex-1",
        order_index: 1,
        planned: { sets: 2, reps: 8 },
        sets: [],
      },
    ]);

    const estimate = estimateSessionComposition(
      session,
      inputMap({ id: "ex-1", metValue: 5, secondsPerRep: null }),
      70,
    );

    expect(estimate.activeDurationSec).toBeNull();
    expect(estimate.minimumTotalDurationSec).toBeNull();
    expect(estimate.normalizedMet).toBeNull();
    expect(estimate.complete).toBe(false);
    expect(estimate.missingInputs).toContain("exercise:ex-1:seconds_per_rep");
  });

  it("weights mixed exercise MET by active duration", () => {
    const session = baseSession([
      {
        id: "se-1",
        session_id: "session-1",
        exercise_id: "ex-1",
        order_index: 1,
        planned: null,
        sets: [{ id: "s1", order_index: 1, duration_sec: 60 }],
      },
      {
        id: "se-2",
        session_id: "session-1",
        exercise_id: "ex-2",
        order_index: 2,
        planned: null,
        sets: [{ id: "s2", order_index: 1, duration_sec: 180 }],
      },
    ]);

    const estimate = estimateSessionComposition(
      session,
      inputMap(
        { id: "ex-1", metValue: 4, secondsPerRep: null },
        { id: "ex-2", metValue: 8, secondsPerRep: null },
      ),
      80,
    );

    expect(estimate.activeDurationSec).toBe(240);
    expect(estimate.normalizedMet).toBe(7);
    expect(estimate.estimatedKcalPerMin).toBe(9.8);
  });

  it("does not fabricate intensity when MET is missing", () => {
    const session = baseSession([
      {
        id: "se-1",
        session_id: "session-1",
        exercise_id: "ex-1",
        order_index: 1,
        planned: null,
        sets: [{ id: "s1", order_index: 1, duration_sec: 60 }],
      },
    ]);

    const estimate = estimateSessionComposition(
      session,
      inputMap({ id: "ex-1", metValue: null, secondsPerRep: null }),
      70,
    );

    expect(estimate.activeDurationSec).toBe(60);
    expect(estimate.normalizedMet).toBeNull();
    expect(estimate.estimatedKcalPerMin).toBeNull();
    expect(estimate.missingInputs).toContain("exercise:ex-1:met_value");
  });
});
