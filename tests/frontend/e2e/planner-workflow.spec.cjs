// Test ownership: #84 (US-4.1), #85 (US-4.2), #88 (US-4.5).
// The planner workflow end to end against the real backend: create a training
// plan in the Training plans dialog, give it a first-week workout, see a stale
// edit refused with the conflict banner, activate it, find the generated
// workout in the next week's calendar, and archive the plan without losing
// its workouts.
const { test, expect } = require("./fixtures.cjs");
const { expectApiHttpError } = require("./browser-diagnostics.cjs");
const {
  APPLICATION_ORIGIN,
  getCsrfToken,
  preparePage,
  retryRateLimitedMutation,
} = require("./server-helpers.cjs");
const {
  BASE_HOUR,
  DAY_MS,
  at,
  createPlannedSession,
  dayKey,
  fetchSession,
  openCalendar,
  scheduleDays,
  slotCell,
  switchView,
} = require("./schedule-helpers.cjs");
const {
  calendarSurface,
  trainingPlans,
} = require("../../../apps/frontend/src/i18n/locales/en/common.json");

// Dates below are computed in UTC, so the browser renders the same calendar days.
test.use({ timezoneId: "UTC" });

const PLAN_HOUR = BASE_HOUR + 3;

async function plansNamed(page, name) {
  const response = await page.context().request.get(`${APPLICATION_ORIGIN}/api/v1/plans`);
  expect(response.ok()).toBe(true);
  return (await response.json()).plans.filter((plan) => plan.name === name);
}

async function renamePlanElsewhere(page, planId, name) {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(request, "rename plan");
  const response = await retryRateLimitedMutation(
    () =>
      request.patch(`${APPLICATION_ORIGIN}/api/v1/plans/${planId}`, {
        data: { name },
        headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
      }),
    "rename plan",
  );
  expect(response.status()).toBe(200);
}

async function planSessions(page, planId) {
  const response = await page.context().request.get(`${APPLICATION_ORIGIN}/api/v1/sessions`, {
    params: { plan_id: planId, limit: "50" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}

const plansDialog = (page) => page.getByRole("dialog", { name: trainingPlans.title });
const planCard = (page, name) =>
  plansDialog(page).locator(".training-summary-card", { hasText: name });

async function openPlans(page) {
  await page.getByRole("button", { name: trainingPlans.actions.manage }).click();
  await expect(plansDialog(page)).toBeVisible();
}

test.describe("Planner workflow", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("create, guard a stale edit, activate, follow in the calendar and archive a plan", async ({
    page,
  }, testInfo) => {
    // Several saves and checks in one scenario: allow twice the default budget.
    test.setTimeout(60_000);
    const { today } = scheduleDays();
    const name = `Planner ${testInfo.testId}`;
    const renamed = `${name} (renamed)`;
    const workout = `Plan workout ${testInfo.testId}`;
    await openCalendar(page);

    // US-4.1-AC01: create the plan in the dialog.
    await openPlans(page);
    await plansDialog(page).getByRole("button", { name: trainingPlans.actions.create }).click();
    const form = page.getByRole("dialog", { name: trainingPlans.createTitle });
    await form.getByLabel(trainingPlans.fields.name).fill(name);
    await form.getByLabel(trainingPlans.fields.startDate).fill(dayKey(today));
    await form.getByLabel(trainingPlans.fields.durationWeeks).fill("2");
    await form.getByLabel(trainingPlans.fields.targetFrequency).fill("1");
    await form.getByRole("button", { name: trainingPlans.actions.save }).click();
    await expect(planCard(page, name)).toBeVisible();
    const [plan] = await plansNamed(page, name);
    expect(plan).toMatchObject({ duration_weeks: 2, target_frequency: 1, time_zone: "UTC" });

    // The first week's workout is the template the plan repeats.
    const template = await createPlannedSession(page, {
      title: workout,
      plannedAt: at(today, PLAN_HOUR, 5),
      durationMin: 30,
      extra: {
        plan_id: plan.id,
        exercises: [
          {
            order: 1,
            exercise_id: null,
            planned: { sets: 1, reps: 5 },
            sets: [{ order: 1, reps: 5 }],
          },
        ],
      },
    });

    // US-4.1-AC04: an edit based on a stale version is refused with the conflict banner.
    await planCard(page, name).getByRole("button", { name: trainingPlans.actions.edit }).click();
    const editForm = page.getByRole("dialog", { name: trainingPlans.editTitle });
    await expect(editForm.getByLabel(trainingPlans.fields.name)).toHaveValue(name);
    await renamePlanElsewhere(page, plan.id, renamed);
    expectApiHttpError(page, "PATCH", `/api/v1/plans/${plan.id}`, 412);
    await editForm.getByLabel(trainingPlans.fields.name).fill(`${name} (stale edit)`);
    await editForm.getByRole("button", { name: trainingPlans.actions.save }).click();
    await expect(editForm.getByText(trainingPlans.errors.conflict)).toBeVisible();
    await editForm.getByRole("button", { name: trainingPlans.actions.reload }).click();
    await expect(editForm.getByLabel(trainingPlans.fields.name)).toHaveValue(renamed);
    await editForm.getByRole("button", { name: trainingPlans.actions.cancel }).click();
    expect((await plansNamed(page, renamed)).length).toBe(1);

    // US-4.2: activation generates the second week from the template.
    await planCard(page, renamed)
      .getByRole("button", { name: trainingPlans.actions.activate })
      .click();
    await expect(planCard(page, renamed)).toContainText("0 of 2 sessions completed");
    const sessions = await planSessions(page, plan.id);
    expect(sessions).toHaveLength(2);
    const generated = sessions.find((session) => session.id !== template.id);
    const nextWeek = new Date(today.getTime() + 7 * DAY_MS);
    expect(new Date(generated.planned_at).toISOString()).toBe(
      at(nextWeek, PLAN_HOUR, 5).toISOString(),
    );
    expect(generated.planned_duration_min).toBe(30);
    await plansDialog(page)
      .getByRole("button", { name: trainingPlans.actions.close })
      .first()
      .click();

    // The calendar shows the generated workout in next week's slot.
    await switchView(page, calendarSurface.views.week);
    await page.getByRole("button", { name: calendarSurface.navigation.nextWeek }).click();
    await expect(slotCell(page, nextWeek, PLAN_HOUR).getByText(workout)).toBeVisible();

    // US-4.1-AC03: archiving the plan keeps its workouts.
    await openPlans(page);
    await planCard(page, renamed)
      .getByRole("button", { name: trainingPlans.actions.delete })
      .click();
    const confirm = page.getByRole("dialog", { name: trainingPlans.delete.title });
    await confirm.getByRole("button", { name: trainingPlans.actions.delete }).click();
    // The plan list returns once the archive is saved, without the plan.
    await expect(confirm).toHaveCount(0);
    await expect(plansDialog(page)).toBeVisible();
    await expect(planCard(page, renamed)).toHaveCount(0);
    expect(await plansNamed(page, renamed)).toEqual([]);
    for (const session of sessions) {
      const kept = await fetchSession(page, session.id);
      expect(kept).toMatchObject({ plan_id: plan.id, status: "planned", deleted_at: null });
    }
  });
});
