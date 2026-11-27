import { describe, expect, it } from "vitest";
import {
  BODY_WEIGHT_KG_LIMITS,
  bodyWeightBounds,
  fromStoredKg,
  KG_PER_LB,
  loadUnitFor,
  toStoredKg,
} from "../../../apps/frontend/src/lib/units/load";

describe("load units", () => {
  it("follows the athlete's measurement system, kilograms by default", () => {
    expect(loadUnitFor("imperial")).toBe("lb");
    expect(loadUnitFor("metric")).toBe("kg");
    expect(loadUnitFor(undefined)).toBe("kg");
  });

  it("uses the exact pound", () => {
    expect(KG_PER_LB).toBe(0.45359237);
  });

  it("leaves kilograms as they are", () => {
    expect(toStoredKg(62.5, "kg")).toBe(62.5);
    expect(fromStoredKg(62.5, "kg")).toBe(62.5);
  });

  it("stores pounds as kilograms to two decimals and shows them to one", () => {
    expect(toStoredKg(45, "lb")).toBe(20.41);
    expect(fromStoredKg(20.41, "lb")).toBe(45);
    expect(fromStoredKg(100, "lb")).toBe(220.5);
  });

  it("round-trips common plate loads without drift", () => {
    for (const pounds of [5, 45, 135, 225, 315, 405, 495]) {
      expect(fromStoredKg(toStoredKg(pounds, "lb"), "lb")).toBe(pounds);
    }
  });

  it("offers body-weight bounds in pounds that convert back inside the kilogram range", () => {
    expect(bodyWeightBounds("kg")).toEqual({ min: 20, max: 400 });
    const { min, max } = bodyWeightBounds("lb");
    expect({ min, max }).toEqual({ min: 44.1, max: 881.84 });
    // The old literals (44.09 and 881.85 lb) converted to just outside 20-400 kg.
    expect(min * KG_PER_LB).toBeGreaterThanOrEqual(BODY_WEIGHT_KG_LIMITS.min);
    expect(max * KG_PER_LB).toBeLessThanOrEqual(BODY_WEIGHT_KG_LIMITS.max);
    expect(44.09 * KG_PER_LB).toBeLessThan(BODY_WEIGHT_KG_LIMITS.min);
    expect(881.85 * KG_PER_LB).toBeGreaterThan(BODY_WEIGHT_KG_LIMITS.max);
  });
});
