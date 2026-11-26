import { describe, expect, it } from "@jest/globals";
import {
  overlappingPairs,
  windowBounds,
  windowsOverlap,
} from "../../../../apps/backend/src/modules/sessions/sessions.schedule.js";

const at = (time: string, durationMin: number) => ({
  start: `2026-11-04T${time}:00.000Z`,
  durationMin,
});

describe("sessions.schedule", () => {
  it("bounds a window by its start and planned length", () => {
    expect(windowBounds(at("08:00", 90))).toEqual([
      Date.parse("2026-11-04T08:00:00.000Z"),
      Date.parse("2026-11-04T09:30:00.000Z"),
    ]);
  });

  it.each([
    ["one starts inside the other", at("08:00", 60), at("08:30", 60), true],
    ["one contains the other", at("08:00", 120), at("08:30", 15), true],
    ["same start", at("08:00", 30), at("08:00", 45), true],
    ["back to back", at("08:00", 60), at("09:00", 60), false],
    ["apart", at("08:00", 30), at("10:00", 30), false],
  ])("%s", (_case, a, b, expected) => {
    expect(windowsOverlap(a, b)).toBe(expected);
    expect(windowsOverlap(b, a)).toBe(expected);
  });

  it("lists every overlapping pair in a batch by original index", () => {
    const pairs = overlappingPairs([
      at("10:00", 60),
      at("08:00", 150),
      at("09:00", 30),
      at("12:00", 30),
    ]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        [1, 2],
        [1, 0],
      ]),
    );
    expect(pairs).toHaveLength(2);
  });

  it("finds no pairs among back-to-back windows", () => {
    expect(overlappingPairs([at("08:00", 60), at("09:00", 60), at("10:00", 60)])).toEqual([]);
  });
});
