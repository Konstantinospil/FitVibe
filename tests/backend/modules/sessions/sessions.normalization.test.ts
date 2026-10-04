import { describe, expect, it } from "@jest/globals";

import { convertExistingExerciseToInput, normalizeSessionExercises } from "../../../../apps/backend/src/modules/sessions/sessions.normalization.js";

describe("session performed-data normalization", () => {
  it("converts legacy actual attributes into canonical exercise sets without losing metrics", () => {
    const recordedAt = "2026-09-22T18:30:00.000Z";

    const [exercise] = normalizeSessionExercises([
      {
        order: 1,
        actual: {
          sets: 3,
          reps: 10,
          load: 80,
          distance: 10,
          duration: "PT45M",
          rpe: 7,
          rest: "PT2M",
          extras: { resistance: "high", speed: "moderate" },
          recorded_at: recordedAt,
        },
      },
    ]);

    expect(exercise).not.toHaveProperty("actual");
    expect(exercise.sets).toHaveLength(3);
    expect(exercise.sets.map((set) => [set.reps, set.weight_kg])).toEqual([
      [10, 80],
      [10, 80],
      [10, 80],
    ]);
    expect(exercise.sets[0]).toMatchObject({
      order_index: 1,
      distance_m: 10_000,
      duration_sec: 2700,
      rpe: 7,
      rest_sec: 120,
      extras: { resistance: "high", speed: "moderate" },
      recorded_at: recordedAt,
    });
    expect(exercise.sets[1].distance_m).toBeNull();
    expect(exercise.sets[1].duration_sec).toBeNull();
    expect(exercise.sets[1].extras).toEqual({});
  });

  it("rejects mixed legacy actual attributes and explicit sets instead of guessing", () => {
    expect(() =>
      normalizeSessionExercises([
        {
          order: 1,
          actual: { reps: 10, load: 80 },
          sets: [{ order: 1, reps: 10, weight_kg: 80 }],
        },
      ]),
    ).toThrow("provide either legacy actual attributes or explicit sets, not both");
  });

  it("keeps explicit set metadata in the canonical set representation", () => {
    const recordedAt = "2026-09-22T18:30:00.000Z";
    const [exercise] = normalizeSessionExercises([
      {
        order: 1,
        sets: [
          {
            order: 1,
            reps: 5,
            weight_kg: 100,
            rest_sec: 90,
            extras: { tempo: "3-1-1" },
            recorded_at: recordedAt,
          },
        ],
      },
    ]);

    expect(exercise).not.toHaveProperty("actual");
    expect(exercise.sets[0]).toMatchObject({
      reps: 5,
      weight_kg: 100,
      rest_sec: 90,
      extras: { tempo: "3-1-1" },
      recorded_at: recordedAt,
    });
  });

  it("copies performed sets only when include_actual is true", () => {
    const exercise = {
      id: "exercise-row-1",
      session_id: "session-1",
      exercise_id: "exercise-1",
      exercise_name: "Squat",
      order_index: 1,
      notes: null,
      planned: { sets: 3, reps: 5, extras: {} },
      actual: null,
      sets: [
        {
          id: "set-1",
          order_index: 1,
          reps: 5,
          weight_kg: 100,
          distance_m: null,
          duration_sec: null,
          rpe: 8,
          rest_sec: 120,
          extras: { tempo: "3-1-1" },
          recorded_at: "2026-09-22T18:30:00.000Z",
          notes: null,
        },
      ],
    };

    expect(convertExistingExerciseToInput(exercise, false)).toMatchObject({
      actual: null,
      sets: [],
    });
    expect(convertExistingExerciseToInput(exercise, true).sets).toEqual([
      expect.objectContaining({
        reps: 5,
        weight_kg: 100,
        rest_sec: 120,
        extras: { tempo: "3-1-1" },
      }),
    ]);
  });

});
