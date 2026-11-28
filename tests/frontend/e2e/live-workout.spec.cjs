// Test ownership: #365 (live workout execution, ADR-043).
// Session page → Start → record against the real backend: complete a set with
// changed values, skip one, add one and complete it, pause and resume, then
// finish. The saved workout keeps each set's outcome and the time paused.
const { test, expect } = require("./fixtures.cjs");
const { preparePage } = require("./server-helpers.cjs");
const {
  BASE_HOUR,
  DAY_MS,
  at,
  createExercise,
  createPlannedSession,
  fetchSession,
  scheduleDays,
} = require("./schedule-helpers.cjs");
const {
  liveWorkout,
  sessionDetail,
  workoutEditor,
} = require("../../../apps/frontend/src/i18n/locales/en/common.json");

test.use({ timezoneId: "UTC" });

// A day no other planner spec schedules on, so this workout never overlaps theirs.
const LIVE_DAY_OFFSET = 3;

const fill = (template, values) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    template,
  );

test.describe("Live workout", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("start a planned workout, record each set as it happens and finish", async ({
    page,
  }, testInfo) => {
    // One scenario with many saves: allow twice the default budget.
    test.setTimeout(60_000);
    const exerciseName = `Live squat ${testInfo.testId}`;
    const title = `Live ${testInfo.testId}`;
    const exercise = await createExercise(page, exerciseName);
    const { today } = scheduleDays();
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(new Date(today.getTime() + LIVE_DAY_OFFSET * DAY_MS), BASE_HOUR + 3, 40),
      extra: {
        exercises: [
          {
            order: 1,
            exercise_id: exercise.id,
            sets: [
              { order: 1, status: "planned", planned: { reps: 5, weight_kg: 60, rest_sec: 30 } },
              { order: 2, status: "planned", planned: { reps: 5, weight_kg: 60, rest_sec: 30 } },
            ],
          },
        ],
      },
    });

    await page.goto(`/sessions/${session.id}`);
    await page.getByRole("button", { name: workoutEditor.actions.start, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${session.id}$`));

    // Set 1 starts from its target; the athlete did one more repetition.
    const current = page.locator("form.live-set");
    await expect(current.getByRole("heading", { level: 2, name: exerciseName })).toBeVisible();
    await expect(
      current.getByText(fill(liveWorkout.current.setOf, { number: 1, count: 2 })),
    ).toBeVisible();
    await expect(current.getByLabel(workoutEditor.fields.repetitions)).toHaveValue("5");
    await current.getByLabel(workoutEditor.fields.repetitions).fill("6");
    await current.getByRole("button", { name: liveWorkout.actions.completeSet }).click();

    // Set 2: the rest countdown runs after the recorded set; this one is skipped.
    await expect(
      current.getByText(fill(liveWorkout.current.setOf, { number: 2, count: 2 })),
    ).toBeVisible();
    await expect(page.getByText(liveWorkout.rest, { exact: true })).toBeVisible();
    await current.getByRole("button", { name: liveWorkout.actions.skipSet }).click();
    await expect(page.getByText(liveWorkout.current.done)).toBeVisible();

    // An extra set starts from the last target.
    await page
      .getByRole("button", { name: fill(liveWorkout.actions.addSetTo, { name: exerciseName }) })
      .click();
    await expect(
      current.getByText(fill(liveWorkout.current.setOf, { number: 3, count: 3 })),
    ).toBeVisible();
    await expect(current.getByLabel(workoutEditor.fields.repetitions)).toHaveValue("5");
    await current.getByRole("button", { name: liveWorkout.actions.completeSet }).click();
    await expect(page.getByText(liveWorkout.current.done)).toBeVisible();

    await page.getByRole("button", { name: liveWorkout.actions.pause, exact: true }).click();
    await expect(page.getByText(liveWorkout.pausedNotice)).toBeVisible();
    await page.getByRole("button", { name: liveWorkout.actions.resume, exact: true }).click();
    await expect(page.getByText(liveWorkout.pausedNotice)).toHaveCount(0);

    await page.getByRole("button", { name: liveWorkout.actions.finish, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: liveWorkout.finish.title });
    await expect(dialog.getByText(liveWorkout.finish.done).locator("..")).toContainText("2");
    await dialog.getByRole("button", { name: liveWorkout.actions.saveCompleted }).click();

    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}$`));
    await expect(page.getByText(sessionDetail.completed, { exact: true })).toBeVisible();
    await expect(page.getByText(sessionDetail.skipped, { exact: true })).toHaveCount(1);

    const saved = await fetchSession(page, session.id);
    expect(saved).toMatchObject({
      status: "completed",
      completion_outcome: "completed",
      paused_at: null,
    });
    expect(saved.paused_seconds).toBeGreaterThanOrEqual(0);
    expect(saved.exercises[0].sets).toEqual([
      expect.objectContaining({
        order_index: 1,
        status: "completed",
        source: "prescribed",
        reps: 6,
        weight_kg: 60,
      }),
      expect.objectContaining({
        order_index: 2,
        status: "skipped",
        source: "prescribed",
        reps: null,
      }),
      expect.objectContaining({
        order_index: 3,
        status: "completed",
        source: "added",
        reps: 5,
        weight_kg: 60,
      }),
    ]);
  });
});
