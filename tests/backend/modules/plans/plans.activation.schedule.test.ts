import { buildWeeklyOccurrences, planEndDate } from "../../../../apps/backend/src/modules/plans/plans.activation.schedule.js";
const sources = [
  { id: "mon", planned_at: "2026-11-02T07:00:00.000Z" },
  { id: "wed", planned_at: "2026-11-04T18:00:00.000Z" },
];
describe("plan recurrence", () => {
  it("generates only subsequent weeks", () => {
    expect(buildWeeklyOccurrences("2026-11-02", 3, 2, sources)).toEqual([
      { sourceId: "mon", plannedAt: "2026-11-09T07:00:00.000Z" },
      { sourceId: "mon", plannedAt: "2026-11-16T07:00:00.000Z" },
      { sourceId: "wed", plannedAt: "2026-11-11T18:00:00.000Z" },
      { sourceId: "wed", plannedAt: "2026-11-18T18:00:00.000Z" },
    ]);
    expect(planEndDate("2026-11-02", 3)).toBe("2026-11-22");
  });
  it("preserves Berlin wall-clock hour over spring daylight saving", () => {
    expect(buildWeeklyOccurrences("2027-03-22", 2, 1, [
      { id: "first", planned_at: "2027-03-22T17:00:00.000Z" },
    ], "Europe/Berlin")).toEqual([
      { sourceId: "first", plannedAt: "2027-03-29T16:00:00.000Z" },
    ]);
  });
  it("rejects invalid boundaries", () => {
    for (const [weeks, frequency] of [[0, 2], [53, 2], [1, 0], [1, 8], [1.5, 2]]) {
      expect(() => buildWeeklyOccurrences("2026-11-02", weeks, frequency, sources)).toThrow();
    }
    expect(() => buildWeeklyOccurrences("2026-11-02", 1, 2, sources, "No/Zone")).toThrow();
  });
});
