import { describe, expect, it } from "@jest/globals";

import {
  convertExistingExerciseToInput,
  normalizeSessionExercises,
} from "../../../../apps/backend/src/modules/sessions/sessions.normalization.js";

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

  it("reuses performed sets as a prescription unless include_actual is true (ADR-042)", () => {
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
          status: "completed" as const,
          source: "prescribed" as const,
          planned: null,
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

    expect(convertExistingExerciseToInput(exercise, false)).toEqual(
      expect.objectContaining({
        actual: null,
        sets: [
          {
            order: 1,
            status: "planned",
            source: "prescribed",
            planned: {
              reps: 5,
              weight_kg: 100,
              distance_m: null,
              duration_sec: null,
              rpe: 8,
              rest_sec: 120,
            },
          },
        ],
      }),
    );
    expect(convertExistingExerciseToInput(exercise, true).sets).toEqual([
      expect.objectContaining({
        status: "completed",
        reps: 5,
        weight_kg: 100,
        rest_sec: 120,
        extras: { tempo: "3-1-1" },
      }),
    ]);
  });

  it("reuses a set's original target over what was done, and drops skipped sets", () => {
    const base = {
      session_id: "session-1",
      exercise_id: "exercise-1",
      exercise_name: "Squat",
      order_index: 1,
      notes: null,
      planned: null,
      actual: null,
    };
    const exercise = {
      ...base,
      id: "exercise-row-1",
      sets: [
        {
          id: "set-1",
          order_index: 1,
          status: "completed" as const,
          source: "prescribed" as const,
          planned: { reps: 5, weight_kg: 100 },
          reps: 4,
          weight_kg: 100,
        },
        {
          id: "set-2",
          order_index: 2,
          status: "skipped" as const,
          source: "prescribed" as const,
          planned: { reps: 5, weight_kg: 100 },
        },
        {
          id: "set-3",
          order_index: 3,
          status: "completed" as const,
          source: "added" as const,
          planned: null,
          reps: 8,
          weight_kg: 80,
        },
      ],
    };

    const reused = convertExistingExerciseToInput(exercise, false).sets;
    expect(reused).toEqual([
      { order: 1, status: "planned", source: "prescribed", planned: { reps: 5, weight_kg: 100 } },
      expect.objectContaining({
        order: 2,
        status: "planned",
        planned: expect.objectContaining({ reps: 8, weight_kg: 80 }),
      }),
    ]);
  });
});

describe("set status and prescription (ADR-042)", () => {
  const normalizeOne = (set: Record<string, unknown>) =>
    normalizeSessionExercises([{ order: 1, sets: [{ order: 1, ...set }] }])[0].sets[0];

  it("treats a set without status as planned and moves legacy top-level targets to planned", () => {
    const set = normalizeOne({ reps: 8, weight_kg: 60, rest_sec: 90 });

    expect(set).toMatchObject({
      status: "planned",
      source: "prescribed",
      planned: { reps: 8, weight_kg: 60, rest_sec: 90 },
      reps: null,
      weight_kg: null,
      rest_sec: null,
    });
  });

  it("treats a set with recorded_at as completed work", () => {
    const set = normalizeOne({ reps: 8, recorded_at: "2026-11-20T10:00:00.000Z" });

    expect(set).toMatchObject({ status: "completed", reps: 8, planned: null });
  });

  it("keeps the prescription and the performed values of a completed set apart", () => {
    const set = normalizeOne({
      status: "completed",
      source: "added",
      planned: { reps: 10 },
      reps: 7,
    });

    expect(set).toMatchObject({
      status: "completed",
      source: "added",
      planned: expect.objectContaining({ reps: 10 }),
      reps: 7,
    });
  });

  it.each([
    [
      "a planned set with targets in both places",
      { status: "planned", planned: { reps: 5 }, reps: 5 },
    ],
    [
      "a planned set with recorded_at",
      { status: "planned", recorded_at: "2026-11-20T10:00:00.000Z" },
    ],
    ["a skipped set with performed values", { status: "skipped", reps: 5 }],
  ])("rejects %s", (_label, set) => {
    expect(() => normalizeOne(set)).toThrow(
      expect.objectContaining({ code: "E.SESSION.INVALID_SET" }),
    );
  });
});
