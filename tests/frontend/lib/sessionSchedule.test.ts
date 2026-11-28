import { describe, expect, it } from "vitest";
import {
  coveredSlotKeys,
  durationForSlotEnd,
  durationOf,
  findScheduleConflicts,
  isReschedulable,
  sessionEnd,
  stepDuration,
  isScheduleStepKey,
  localDateKey,
  localDateTimeToIso,
  localTimeKey,
  moveToLocalDay,
  plannedAtForTarget,
  slotKey,
  stepScheduleTarget,
  targetKeyFor,
} from "../../src/lib/scheduling/sessionSchedule";
import type { SessionListItem } from "../../src/services/sessionApi";

const at = (year: number, month: number, day: number, hours: number, minutes = 0) =>
  new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();

const session = (overrides: Partial<SessionListItem>): SessionListItem => ({
  id: "session",
  owner_id: "user-1",
  planned_at: at(2026, 11, 2, 8),
  planned_duration_min: 60,
  status: "planned",
  visibility: "private",
  exercise_count: 0,
  ...overrides,
});

describe("sessionSchedule", () => {
  describe("local keys", () => {
    it("formats the local day and time of an instant", () => {
      const instant = at(2026, 3, 9, 7, 5);
      expect(localDateKey(instant)).toBe("2026-03-09");
      expect(localTimeKey(instant)).toBe("07:05");
    });
  });

  describe("localDateTimeToIso", () => {
    it("combines a local day and time into the matching instant", () => {
      expect(localDateTimeToIso("2026-11-04", "18:30")).toBe(at(2026, 11, 4, 18, 30));
    });

    it.each([
      ["", "08:00"],
      ["2026-11-04", ""],
      ["04.11.2026", "08:00"],
      ["2026-11-04", "8:00"],
      ["2026-02-30", "08:00"],
      ["2026-11-04", "25:00"],
    ])("rejects malformed or impossible input %s %s", (day, time) => {
      expect(localDateTimeToIso(day, time)).toBeNull();
    });
  });

  describe("moveToLocalDay", () => {
    it("keeps the local time of day when moving to another day", () => {
      expect(moveToLocalDay(at(2026, 11, 2, 18, 15), "2026-11-05")).toBe(at(2026, 11, 5, 18, 15));
    });

    it("rejects a malformed target day", () => {
      expect(moveToLocalDay(at(2026, 11, 2, 18), "not-a-day")).toBeNull();
    });
  });

  describe("schedule targets", () => {
    it("builds zero-padded hour-slot keys", () => {
      expect(slotKey("2026-11-04", 7)).toBe("2026-11-04T07");
    });

    it("rejects an hour slot outside the day", () => {
      expect(plannedAtForTarget(at(2026, 11, 4, 18), "2026-11-04T24")).toBeNull();
    });

    it("reports the target a session occupies at each granularity", () => {
      const instant = at(2026, 11, 4, 18, 45);
      expect(targetKeyFor(instant, "day")).toBe("2026-11-04");
      expect(targetKeyFor(instant, "hour")).toBe("2026-11-04T18");
    });

    it("keeps the local time on a day target and the minutes on an hour slot", () => {
      const instant = at(2026, 11, 4, 18, 45);
      expect(plannedAtForTarget(instant, "2026-11-06")).toBe(at(2026, 11, 6, 18, 45));
      expect(plannedAtForTarget(instant, "2026-11-06T07")).toBe(at(2026, 11, 6, 7, 45));
      expect(plannedAtForTarget(instant, "nope")).toBeNull();
    });
  });

  describe("stepScheduleTarget", () => {
    const week = Array.from({ length: 14 }, (_, index) =>
      localDateKey(at(2026, 11, 2 + index, 12)),
    );

    it("recognises only arrow keys as steps", () => {
      expect(isScheduleStepKey("ArrowLeft")).toBe(true);
      expect(isScheduleStepKey("ArrowDown")).toBe(true);
      expect(isScheduleStepKey("Enter")).toBe(false);
    });

    it("moves day targets by a day horizontally and a week vertically", () => {
      expect(stepScheduleTarget("2026-11-04", "ArrowRight", week)).toBe("2026-11-05");
      expect(stepScheduleTarget("2026-11-04", "ArrowLeft", week)).toBe("2026-11-03");
      expect(stepScheduleTarget("2026-11-04", "ArrowDown", week)).toBe("2026-11-11");
      expect(stepScheduleTarget("2026-11-11", "ArrowUp", week)).toBe("2026-11-04");
    });

    it("stays inside the visible days", () => {
      expect(stepScheduleTarget("2026-11-02", "ArrowLeft", week)).toBe("2026-11-02");
      expect(stepScheduleTarget("2026-11-10", "ArrowDown", week)).toBe("2026-11-10");
      expect(stepScheduleTarget("2026-12-24", "ArrowRight", week)).toBe("2026-12-24");
    });

    it("moves hour slots by a day horizontally and an hour vertically, within the day", () => {
      expect(stepScheduleTarget("2026-11-04T18", "ArrowRight", week)).toBe("2026-11-05T18");
      expect(stepScheduleTarget("2026-11-04T18", "ArrowDown", week)).toBe("2026-11-04T19");
      expect(stepScheduleTarget("2026-11-04T18", "ArrowUp", week)).toBe("2026-11-04T17");
      expect(stepScheduleTarget("2026-11-04T23", "ArrowDown", week)).toBe("2026-11-04T23");
      expect(stepScheduleTarget("2026-11-04T00", "ArrowUp", week)).toBe("2026-11-04T00");
    });

    it("keeps a single-day view on its day", () => {
      expect(stepScheduleTarget("2026-11-04T18", "ArrowRight", ["2026-11-04"])).toBe(
        "2026-11-04T18",
      );
    });
  });

  describe("isReschedulable", () => {
    it("allows only active planned sessions to move", () => {
      expect(isReschedulable({ status: "planned" })).toBe(true);
      expect(isReschedulable({ status: "planned", deleted_at: at(2026, 11, 1, 9) })).toBe(false);
      expect(isReschedulable({ status: "in_progress" })).toBe(false);
      expect(isReschedulable({ status: "completed" })).toBe(false);
      expect(isReschedulable({ status: "canceled" })).toBe(false);
    });
  });

  describe("findScheduleConflicts", () => {
    const target = at(2026, 11, 4, 8);
    const sessions = [
      session({ id: "moving", planned_at: at(2026, 11, 2, 8) }),
      session({ id: "same-start", planned_at: target, planned_duration_min: 30 }),
      session({
        id: "starts-inside",
        planned_at: at(2026, 11, 4, 8, 45),
        planned_duration_min: 15,
      }),
      session({ id: "ends-inside", planned_at: at(2026, 11, 4, 7, 30), planned_duration_min: 45 }),
      session({ id: "back-to-back", planned_at: at(2026, 11, 4, 9) }),
      session({ id: "ends-at-start", planned_at: at(2026, 11, 4, 7), planned_duration_min: 60 }),
      session({ id: "canceled", planned_at: target, status: "canceled" }),
      session({ id: "deleted", planned_at: target, deleted_at: at(2026, 11, 1, 9) }),
      session({ id: "completed-overlap", planned_at: at(2026, 11, 4, 8, 15), status: "completed" }),
    ];

    it("reports active sessions whose planned time overlaps, including completed records", () => {
      expect(findScheduleConflicts(sessions, "moving", target, 60).map(({ id }) => id)).toEqual([
        "same-start",
        "starts-inside",
        "ends-inside",
        "completed-overlap",
      ]);
    });

    it("treats back-to-back sessions as free", () => {
      const ids = findScheduleConflicts(sessions, "moving", target, 60).map(({ id }) => id);
      expect(ids).not.toContain("back-to-back");
      expect(ids).not.toContain("ends-at-start");
    });

    it("grows with the planned length", () => {
      expect(findScheduleConflicts(sessions, "moving", target, 61).map(({ id }) => id)).toContain(
        "back-to-back",
      );
    });

    it("never reports the moved session against itself", () => {
      expect(findScheduleConflicts(sessions, "same-start", target, 30).map(({ id }) => id)).toEqual(
        ["ends-inside", "completed-overlap"],
      );
    });

    it("compares instants rather than ISO string spellings", () => {
      const spelled = [session({ id: "other", planned_at: "2026-11-04T08:00:00Z" })];
      expect(findScheduleConflicts(spelled, "moving", "2026-11-04T08:00:00.000Z", 5)).toHaveLength(
        1,
      );
    });

    it("uses the default length for sessions cached without one", () => {
      const legacy = [
        session({ id: "legacy", planned_at: target, planned_duration_min: undefined }),
      ];
      expect(durationOf(legacy[0])).toBe(60);
      expect(findScheduleConflicts(legacy, "moving", at(2026, 11, 4, 8, 59), 5)).toHaveLength(1);
    });
  });

  describe("durations", () => {
    it("computes the end of a session", () => {
      expect(sessionEnd(at(2026, 11, 4, 18, 20), 100)).toBe(at(2026, 11, 4, 20));
    });

    it("lists the hour slots a session reaches into, across midnight", () => {
      expect(coveredSlotKeys(at(2026, 11, 4, 18, 30), 90)).toEqual([
        "2026-11-04T18",
        "2026-11-04T19",
      ]);
      expect(coveredSlotKeys(at(2026, 11, 4, 18), 60)).toEqual(["2026-11-04T18"]);
      expect(coveredSlotKeys(at(2026, 11, 4, 23, 30), 45)).toEqual([
        "2026-11-04T23",
        "2026-11-05T00",
      ]);
    });

    it("ends a resized session where the target hour slot ends", () => {
      const start = at(2026, 11, 4, 18, 20);
      expect(durationForSlotEnd(start, slotKey("2026-11-04", 19))).toBe(100);
      expect(durationForSlotEnd(start, slotKey("2026-11-04", 18))).toBe(40);
    });

    it("clamps resized lengths and ignores day targets", () => {
      const start = at(2026, 11, 4, 18, 20);
      expect(durationForSlotEnd(start, slotKey("2026-11-04", 9))).toBe(5);
      expect(durationForSlotEnd(at(2026, 11, 4, 0), slotKey("2026-11-05", 20))).toBe(720);
      expect(durationForSlotEnd(start, "2026-11-04")).toBeNull();
      expect(durationForSlotEnd(start, "not-a-target")).toBeNull();
    });

    it("steps lengths with the up and down arrows inside the limits", () => {
      expect(stepDuration(60, "ArrowDown")).toBe(75);
      expect(stepDuration(60, "ArrowUp")).toBe(45);
      expect(stepDuration(10, "ArrowUp")).toBe(5);
      expect(stepDuration(715, "ArrowDown")).toBe(720);
      expect(stepDuration(60, "ArrowLeft")).toBeNull();
      expect(stepDuration(60, "Enter")).toBeNull();
    });
  });
});
