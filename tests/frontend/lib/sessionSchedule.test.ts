import { describe, expect, it } from "vitest";
import {
  findScheduleConflicts,
  isReschedulable,
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
      session({ id: "same-instant", planned_at: target }),
      session({ id: "same-day-other-time", planned_at: at(2026, 11, 4, 9) }),
      session({ id: "canceled", planned_at: target, status: "canceled" }),
      session({ id: "deleted", planned_at: target, deleted_at: at(2026, 11, 1, 9) }),
      session({ id: "completed-same-instant", planned_at: target, status: "completed" }),
    ];

    it("reports active sessions at the same instant, including completed records", () => {
      expect(findScheduleConflicts(sessions, "moving", target).map(({ id }) => id)).toEqual([
        "same-instant",
        "completed-same-instant",
      ]);
    });

    it("never reports the moved session against itself", () => {
      expect(findScheduleConflicts(sessions, "same-instant", target).map(({ id }) => id)).toEqual([
        "completed-same-instant",
      ]);
    });

    it("compares instants rather than ISO string spellings", () => {
      const spelled = [session({ id: "other", planned_at: "2026-11-04T08:00:00Z" })];
      expect(findScheduleConflicts(spelled, "moving", "2026-11-04T08:00:00.000Z")).toHaveLength(1);
    });
  });
});
