import { matchesPlanIfMatch, planETag } from "../../../../apps/backend/src/modules/plans/plans.etag.js";
import type { PlanRow } from "../../../../apps/backend/src/modules/plans/plans.repository.js";

describe("plan strong ETag", () => {
  const plan = { id: "plan-1", revision: 4 } as PlanRow;

  it("derives the validator from a persisted revision", () => {
    expect(planETag(plan)).toBe('"plan-plan-1-4"');
  });

  it("accepts the matching validator, including a list of alternatives", () => {
    expect(matchesPlanIfMatch(plan, '"outdated", "plan-plan-1-4"')).toBe(true);
  });

  it("rejects stale, malformed, or wildcard validators", () => {
    expect(matchesPlanIfMatch(plan, '"plan-plan-1-3"')).toBe(false);
    expect(matchesPlanIfMatch(plan, 'W/"plan-plan-1-4"')).toBe(false);
    expect(matchesPlanIfMatch(plan, "*")).toBe(false);
  });
});
