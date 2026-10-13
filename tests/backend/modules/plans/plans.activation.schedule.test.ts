import { buildWeeklyOccurrences, planEndDate } from "../../../../apps/backend/src/modules/plans/plans.activation.schedule.js";

const templates = [
  { id: "mon", planned_at: "2026-11-02T07:00:00.000Z" },
  { id: "wed", planned_at: "2026-11-04T18:00:00.000Z" },
];

describe("Plan weekly activation schedule", () => {
  it("generates the remaining weekly sessions without duplicating the template week", () => {
    expect(buildWeeklyOccurrences("2026-11-02", 3, 2, templates)).toEqual([
      { sourceId: "mon", plannedAt: "2026-11-09T07:00:00.000Z" },
      { sourceId: "mon", plannedAt: "2026-11-16T07:00:00.000Z" },
      { sourceId: "wed", plannedAt: "2026-11-11T18:00:00.000Z" },
      { sourceId: "wed", plannedAt: "2026-11-18T18:00:00.000Z" },
    ]);
    expect(planEndDate("2026-11-02", 3)).toBe("2026-11-22");
  });
  it("supports a one-week plan without adding sessions", () => {
    expect(buildWeeklyOccurrences("2026-11-02", 1, 2, templates)).toEqual([]);
  });
  it.each([[0, 2], [53, 2], [1, 0], [1, 8], [1.5, 2], [1, 2.5]])(
    "rejects out-of-range or fractional schedule settings (%s weeks, %s sessions)",
    (weeks, frequency) => {
      expect(() => buildWeeklyOccurrences("2026-11-02", weeks, frequency, templates)).toThrow();
    },
  );
  it("rejects a frequency mismatch and templates outside the first week", () => {
    expect(() => buildWeeklyOccurrences("2026-11-02", 2, 1, templates)).toThrow();
    expect(() => buildWeeklyOccurrences("2026-11-02", 2, 2, [
      templates[0], { id: "late", planned_at: "2026-11-09T18:00:00.000Z" },
    ])).toThrow();
  });
  it("rejects invalid dates and duplicate source times", () => {
    expect(() => buildWeeklyOccurrences("2026-02-30", 2, 2, templates)).toThrow();
    expect(() => buildWeeklyOccurrences("2026-11-02", 2, 2, [templates[0], { id: "dup", planned_at: templates[0].planned_at }])).toThrow();
  });
});
