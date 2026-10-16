import type { PlanRow } from "./plans.repository.js";

/** Strong entity tag for plan writes; revision increments in the database. */
export function planETag(plan: Pick<PlanRow, "id" | "revision">): string {
  return `"plan-${plan.id}-${plan.revision}"`;
}

/** Multiple validators are permitted by the HTTP If-Match field syntax. */
export function matchesPlanIfMatch(plan: PlanRow, header: string): boolean {
  const current = planETag(plan);
  return header.split(",").some((candidate) => candidate.trim() === current);
}
