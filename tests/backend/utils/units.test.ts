import { describe, expect, it } from "@jest/globals";
import {
  BODY_WEIGHT_KG_LIMITS,
  KG_PER_LB,
  kgToLb,
  lbToKg,
} from "../../../apps/backend/src/utils/units.js";

describe("weight units", () => {
  it("uses the exact pound, as the frontend does", () => {
    expect(KG_PER_LB).toBe(0.45359237);
  });

  it("converts both ways without drift", () => {
    expect(lbToKg(100)).toBeCloseTo(45.359237, 9);
    expect(kgToLb(lbToKg(165.5))).toBeCloseTo(165.5, 9);
  });

  it("keeps the profile range the frontend offers", () => {
    expect(BODY_WEIGHT_KG_LIMITS).toEqual({ min: 20, max: 400 });
  });
});
