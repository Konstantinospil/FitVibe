import { describe, expect, it } from "vitest";
import {
  EMPTY_SET_INPUTS,
  invalidMetric,
  isBlankSet,
  SET_METRIC_FIELDS,
  toMetricInputs,
  toMetricValues,
} from "../../../apps/frontend/src/lib/forms/setMetrics";

const inputs = (values: Partial<typeof EMPTY_SET_INPUTS>) => ({ ...EMPTY_SET_INPUTS, ...values });

describe("set metrics", () => {
  it("accepts blank fields and valid values", () => {
    expect(invalidMetric(EMPTY_SET_INPUTS)).toBeNull();
    expect(invalidMetric(inputs({ reps: "8", weight_kg: "62.5", rpe: "10" }))).toBeNull();
  });

  it("rejects fractions where whole numbers are needed, negatives, and RPE outside 1 to 10", () => {
    expect(invalidMetric(inputs({ reps: "8.5" }))).toBe("reps");
    expect(invalidMetric(inputs({ weight_kg: "-1" }))).toBe("weight_kg");
    expect(invalidMetric(inputs({ distance_m: "abc" }))).toBe("distance_m");
    expect(invalidMetric(inputs({ rpe: "0" }))).toBe("rpe");
    expect(invalidMetric(inputs({ rpe: "11" }))).toBe("rpe");
  });

  it("checks only the fields it is given", () => {
    const repsOnly = SET_METRIC_FIELDS.filter(({ metric }) => metric === "reps");
    expect(invalidMetric(inputs({ rpe: "11" }), repsOnly)).toBeNull();
  });

  it("treats a set without values as blank", () => {
    expect(isBlankSet(inputs({ reps: "  " }))).toBe(true);
    expect(isBlankSet(inputs({ reps: "1" }))).toBe(false);
  });

  it("converts between inputs and values, blank as null", () => {
    expect(toMetricValues(inputs({ reps: "5", weight_kg: "100" }))).toEqual({
      reps: 5,
      weight_kg: 100,
      duration_sec: null,
      distance_m: null,
      rpe: null,
    });
    expect(toMetricInputs({ reps: 5, weight_kg: null, rpe: 0 })).toEqual(
      inputs({ reps: "5", rpe: "0" }),
    );
    expect(toMetricInputs(null)).toEqual(EMPTY_SET_INPUTS);
  });
});
