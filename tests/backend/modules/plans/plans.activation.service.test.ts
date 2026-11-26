import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { activateUserPlan } from "../../../../apps/backend/src/modules/plans/plans.activation.service.js";
import * as sessionsRepository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import * as plansRepository from "../../../../apps/backend/src/modules/plans/plans.repository.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import { logger } from "../../../../apps/backend/src/config/logger.js";
import type { PlanRow } from "../../../../apps/backend/src/modules/plans/plans.repository.js";
import type { SessionWithExercises } from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

/**
 * Unit coverage of plan activation's rules (US-4.2, US-4.5-AC01). The transaction is
 * a scripted fake: the real queries are exercised by plan-activation.integration.test.ts.
 */

interface Script {
  plan: Partial<PlanRow> | undefined;
  sources: Array<{ id: string; planned_at: string; status: string }>;
  stats: { total: string; completed: string };
  updated: Partial<PlanRow> | undefined;
}

let script: Script;

const builder = (table: string) => {
  const chain = {
    where: () => chain,
    whereNull: () => chain,
    forUpdate: () => chain,
    orderBy: () => chain,
    select: () => chain,
    update: () => chain,
    first: async () => (table === "plans" ? script.plan : script.stats),
    returning: async () => (script.updated ? [script.updated] : []),
    then: (resolve: (rows: unknown) => unknown) => resolve(script.sources),
  };
  return chain;
};

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const trx = Object.assign((table: string) => builder(table), { raw: (sql: string) => sql });
  return { db: { transaction: async (work: (t: unknown) => unknown) => work(trx) } };
});
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js", () => ({
  createSession: jest.fn(),
  getSessionWithDetails: jest.fn(),
  refreshSessionSummary: jest.fn(),
  replaceSessionExercises: jest.fn(),
  findOverlappingSessions: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/plans/plans.repository.js", () => ({
  updatePlanProgress: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/config/logger.js", () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const sessions = jest.mocked(sessionsRepository);
const plans = jest.mocked(plansRepository);

const userId = "user-1";
const planId = "plan-1";
const monday = "2026-11-02T08:00:00.000Z";
const wednesday = "2026-11-04T18:30:00.000Z";

const template = (id: string, plannedAt: string, overrides: Partial<SessionWithExercises> = {}) =>
  ({
    id,
    owner_id: userId,
    plan_id: planId,
    title: `Template ${id}`,
    planned_at: plannedAt,
    planned_duration_min: 45,
    status: "planned",
    visibility: "private",
    notes: null,
    recurrence_rule: null,
    exercises: [
      {
        id: `${id}-exercise`,
        session_id: id,
        exercise_id: null,
        order_index: 1,
        planned: { sets: 2, reps: 8 },
        sets: [{ id: `${id}-set`, order_index: 1, reps: 8, rest_sec: 90 }],
      },
    ],
    ...overrides,
  }) as SessionWithExercises;

const templates = new Map<string, SessionWithExercises>();

const activePlan: Partial<PlanRow> = {
  id: planId,
  user_id: userId,
  status: "active",
  start_date: "2026-11-02",
  end_date: null,
  duration_weeks: 2,
  target_frequency: 2,
  time_zone: "UTC",
  activated_at: null,
};

describe("activateUserPlan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    templates.clear();
    templates.set("t1", template("t1", monday));
    templates.set("t2", template("t2", wednesday));
    script = {
      plan: { ...activePlan },
      sources: [...templates.values()].map(({ id, planned_at, status }) => ({
        id,
        planned_at,
        status,
      })),
      stats: { total: "4", completed: "0" },
      updated: { ...activePlan, activated_at: "now", session_count: 4 },
    };
    sessions.getSessionWithDetails.mockImplementation(
      async (id: string) => templates.get(id) ?? null,
    );
    sessions.findOverlappingSessions.mockResolvedValue([]);
  });

  it("generates the later weeks from the templates, keeping their length and sets", async () => {
    const result = await activateUserPlan(userId, planId);

    expect(result).toMatchObject({ id: planId, activated_at: "now" });
    expect(sessions.createSession).toHaveBeenCalledTimes(2);
    const created = sessions.createSession.mock.calls.map(([row]) => row);
    expect(created.map((row) => row.planned_at)).toEqual([
      "2026-11-09T08:00:00.000Z",
      "2026-11-11T18:30:00.000Z",
    ]);
    expect(created.every((row) => row.planned_duration_min === 45)).toBe(true);
    expect(created.every((row) => row.status === "planned" && row.plan_id === planId)).toBe(true);
    const [, , exercises] = sessions.replaceSessionExercises.mock.calls[0];
    expect(exercises[0].sets).toEqual([
      // The templates' targets become the generated sessions' prescription (ADR-042).
      expect.objectContaining({
        order_index: 1,
        status: "planned",
        planned: expect.objectContaining({ reps: 8, rest_sec: 90 }),
        reps: null,
        recorded_at: null,
      }),
    ]);
    expect(plans.updatePlanProgress).toHaveBeenCalledWith(planId, 4, 0, expect.anything());
    expect(insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "activate",
        metadata: expect.objectContaining({ generated_sessions: 2 }),
      }),
    );
    expect(sessions.refreshSessionSummary).toHaveBeenCalled();
  });

  it("checks every generated session's time against existing sessions", async () => {
    await activateUserPlan(userId, planId);

    expect(sessions.findOverlappingSessions).toHaveBeenCalledWith(
      userId,
      [
        { start: "2026-11-09T08:00:00.000Z", durationMin: 45 },
        { start: "2026-11-11T18:30:00.000Z", durationMin: 45 },
      ],
      {},
      expect.anything(),
    );
  });

  it("refuses with 409 when generated sessions would overlap existing ones", async () => {
    sessions.findOverlappingSessions.mockResolvedValue([
      { id: "busy", planned_at: "2026-11-09T08:30:00.000Z", planned_duration_min: 30 },
    ]);

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({
      status: 409,
      code: "E.PLAN.SCHEDULE_CONFLICT",
      details: { conflicts: ["2026-11-09T08:30:00.000Z"] },
    });
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("refuses with 409 when two templates would overlap each other", async () => {
    templates.set("t2", template("t2", "2026-11-02T08:30:00.000Z"));
    script.sources[1].planned_at = "2026-11-02T08:30:00.000Z";

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({
      status: 409,
      details: { conflicts: ["2026-11-09T08:00:00.000Z", "2026-11-09T08:30:00.000Z"] },
    });
  });

  it.each([
    ["missing", undefined, 404, "E.PLAN.NOT_FOUND"],
    [
      "already activated",
      { ...activePlan, activated_at: "earlier" },
      409,
      "E.PLAN.ALREADY_ACTIVATED",
    ],
    ["completed", { ...activePlan, status: "completed" }, 409, "E.PLAN.COMPLETED"],
    ["without a schedule", { ...activePlan, duration_weeks: null }, 422, "E.PLAN.INCOMPLETE"],
    [
      "with a mismatched end date",
      { ...activePlan, end_date: "2026-12-31" },
      422,
      "E.PLAN.INVALID_END_DATE",
    ],
  ])("refuses a plan that is %s", async (_case, plan, status, code) => {
    script.plan = plan as Partial<PlanRow> | undefined;

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({ status, code });
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("requires every first-week session to be planned", async () => {
    script.sources[0].status = "completed";

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({
      status: 422,
      code: "E.PLAN.INVALID_TEMPLATE",
    });
  });

  it.each([
    ["has no exercises", { exercises: [] }, "E.PLAN.INVALID_TEMPLATE"],
    [
      "repeats other than weekly",
      { recurrence_rule: "FREQ=DAILY" },
      "E.PLAN.UNSUPPORTED_RECURRENCE",
    ],
  ])("refuses a template that %s", async (_case, overrides, code) => {
    templates.set("t1", template("t1", monday, overrides as Partial<SessionWithExercises>));

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({ status: 422, code });
  });

  it("accepts a weekly recurrence rule on a template", async () => {
    templates.set(
      "t1",
      template("t1", monday, { recurrence_rule: "RRULE:FREQ=WEEKLY;INTERVAL=1" }),
    );

    await expect(activateUserPlan(userId, planId)).resolves.toMatchObject({ id: planId });
  });

  it("refuses a template that holds performed results", async () => {
    const performed = template("t1", monday);
    performed.exercises[0].sets[0].recorded_at = "2026-11-02T09:00:00.000Z";
    templates.set("t1", performed);

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({
      status: 422,
      code: "E.PLAN.INVALID_TEMPLATE",
    });
  });

  it("fails when the plan update returns nothing", async () => {
    script.updated = undefined;

    await expect(activateUserPlan(userId, planId)).rejects.toMatchObject({
      status: 500,
      code: "E.PLAN.ACTIVATION_FAILED",
    });
  });

  it("keeps the activation when the summary refresh fails afterwards", async () => {
    sessions.refreshSessionSummary.mockRejectedValueOnce(new Error("refresh failed"));

    await expect(activateUserPlan(userId, planId)).resolves.toMatchObject({ id: planId });
    expect(logger.error).toHaveBeenCalled();
  });
});
