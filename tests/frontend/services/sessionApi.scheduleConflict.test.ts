import { describe, expect, it } from "vitest";
import { getScheduleConflictIds } from "../../src/services/sessionApi";

// Same shape the repository's other API tests use for axios errors.
const axiosError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: { status, data },
});

describe("getScheduleConflictIds", () => {
  it("returns the conflicting session IDs of a schedule-conflict response", () => {
    const error = axiosError(422, {
      error: {
        code: "E.SESSION.SCHEDULE_CONFLICT",
        message: "Another session is already planned at this time",
        details: { conflictingSessionIds: ["a", "b"] },
      },
    });

    expect(getScheduleConflictIds(error)).toEqual(["a", "b"]);
  });

  it("returns an empty list when a schedule conflict carries no usable IDs", () => {
    const error = axiosError(422, {
      error: { code: "E.SESSION.SCHEDULE_CONFLICT", details: { conflictingSessionIds: [7, "c"] } },
    });

    expect(getScheduleConflictIds(error)).toEqual(["c"]);
  });

  it.each([
    ["another 422 code", axiosError(422, { error: { code: "VALIDATION_ERROR" } })],
    ["a different status", axiosError(409, { error: { code: "E.SESSION.SCHEDULE_CONFLICT" } })],
    ["a body without an error envelope", axiosError(422, "unprocessable")],
    ["a non-HTTP error", new Error("offline")],
  ])("returns null for %s", (_label, error) => {
    expect(getScheduleConflictIds(error)).toBeNull();
  });
});
