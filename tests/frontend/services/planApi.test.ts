import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateTrainingPlan, createTrainingPlan, deleteTrainingPlan,
  getTrainingPlan, isTrainingPlanConflict, listTrainingPlans,
  updateTrainingPlan, type TrainingPlan, type TrainingPlanInput,
} from "../../src/services/planApi";
import { apiClient } from "../../src/services/httpApi";

vi.mock("../../src/services/httpApi", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const plan: TrainingPlan = {
  id: "plan-1", user_id: "user-1", name: "Strength", status: "active",
  start_date: null, end_date: null, session_count: 0, completed_count: 0,
  progress_percent: 0, revision: 3, archived_at: null,
};

describe("training plan API contract", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the server-provided plan list", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { plans: [plan] } });
    await expect(listTrainingPlans()).resolves.toEqual([plan]);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/plans");
  });

  it("rejects absent, weak and nonstring ETags before allowing plan edits", async () => {
    for (const etag of [undefined, 'W/"revision-3"', 3]) {
      vi.mocked(apiClient.get).mockResolvedValue({ data: plan, headers: { etag } });
      await expect(getTrainingPlan(plan.id)).rejects.toThrow("strong ETag");
    }
    vi.mocked(apiClient.get).mockResolvedValue({
      data: plan, headers: { etag: '"revision-3"' },
    });
    await expect(getTrainingPlan(plan.id)).resolves.toEqual({
      plan, etag: '"revision-3"',
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/plans/plan-1");
  });

  it("sends the server validator on edits to prevent lost updates", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: plan });
    await expect(updateTrainingPlan(plan.id, { name: "Updated" }, '"revision-3"')).resolves.toEqual(plan);
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/v1/plans/plan-1", { name: "Updated" },
      { headers: { "If-Match": '"revision-3"' } },
    );
  });

  it("creates, activates and archives through separate API routes", async () => {
    const input: TrainingPlanInput = { name: "Strength", start_date: null, end_date: null };
    vi.mocked(apiClient.post).mockResolvedValue({ data: plan });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });
    await expect(createTrainingPlan(input)).resolves.toEqual(plan);
    await expect(activateTrainingPlan(plan.id)).resolves.toEqual(plan);
    await expect(deleteTrainingPlan(plan.id)).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/api/v1/plans", input);
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/api/v1/plans/plan-1/activate", {});
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/plans/plan-1");
  });

  it("recognizes only HTTP 412 Axios errors as write conflicts", () => {
    expect(isTrainingPlanConflict(new Error("Precondition failed"))).toBe(false);
    expect(isTrainingPlanConflict({ response: { status: 412 } })).toBe(false);
    const makeError = (status: number) => ({ isAxiosError: true, response: { status } });
    expect(isTrainingPlanConflict(makeError(412))).toBe(true);
    expect(isTrainingPlanConflict(makeError(400))).toBe(false);
  });
});
