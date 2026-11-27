// Test ownership: #89 / #289 (manual Log, ADR-042).
// Home → Log → save → result against the real backend: a past workout is saved
// in one request as a completed session with performed sets, then opens on its
// session page, where the server-awarded points appear.
const { test, expect } = require("./fixtures.cjs");
const { preparePage, waitForApp } = require("./server-helpers.cjs");
const {
  DAY_MS,
  createExercise,
  escapeRegExp,
  fetchSession,
  pad,
} = require("./schedule-helpers.cjs");
const {
  calendarSurface,
  homeSurface,
  logSurface,
  sessionDetail,
  workoutEditor,
} = require("../../../apps/frontend/src/i18n/locales/en/common.json");

test.use({ timezoneId: "UTC" });

test.describe("Manual Log", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("log a past workout from Home and see its result", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const exerciseName = `Log squat ${testInfo.testId}`;
    const title = `Logged ${testInfo.testId}`;
    await createExercise(page, exerciseName);
    const yesterday = new Date(Date.now() - DAY_MS);
    const day = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;

    await page.goto("/");
    await waitForApp(page);
    await page.getByRole("button", { name: logSurface.title, exact: true }).click();
    await expect(page).toHaveURL(/\/log$/);
    await expect(page.getByRole("heading", { level: 1, name: logSurface.title })).toBeVisible();

    await page.getByLabel(workoutEditor.fields.name).fill(title);
    await page.getByLabel(calendarSurface.schedule.fields.day).fill(day);
    await page.getByLabel(logSurface.fields.startTime).fill("07:00");
    await page.getByLabel(calendarSurface.schedule.fields.duration).fill("30");

    await page
      .getByRole("textbox", {
        name: new RegExp(`^${escapeRegExp(workoutEditor.fields.exercise)} `),
      })
      .fill(exerciseName);
    const exerciseList = page.getByRole("combobox", {
      name: workoutEditor.fields.exercise,
      exact: true,
    });
    await expect(exerciseList.getByRole("option", { name: exerciseName })).toHaveCount(1);
    await exerciseList.selectOption({ label: exerciseName });
    await page
      .getByRole("button", { name: workoutEditor.actions.addExercise, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 4, name: exerciseName })).toBeVisible();

    const firstSet = page.getByRole("group", { name: "Set 1", exact: true });
    await firstSet.getByLabel(workoutEditor.fields.repetitions).fill("5");
    await firstSet.getByLabel(logSurface.fields.weight).fill("60");
    // The second set starts from the first.
    await page.getByRole("button", { name: logSurface.actions.addSet, exact: true }).click();
    await expect(
      page
        .getByRole("group", { name: "Set 2", exact: true })
        .getByLabel(workoutEditor.fields.repetitions),
    ).toHaveValue("5");

    await page.getByRole("button", { name: logSurface.actions.save, exact: true }).click();

    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
    const sessionId = new URL(page.url()).pathname.split("/").pop();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(sessionDetail.completed, { exact: true })).toBeVisible();
    await expect(page.getByText("Reps: 5 · Load: 60 kg")).toHaveCount(2);
    // Points come from the server; the page checks again until they arrive.
    await expect(
      page.getByText(new RegExp(`^${homeSurface.session.points.replace("{{count}}", "\\d+")}$`)),
    ).toBeVisible({ timeout: 20_000 });

    const saved = await fetchSession(page, sessionId);
    expect(saved).toMatchObject({
      title,
      status: "completed",
      completion_outcome: "completed",
      planned_duration_min: 30,
      started_at: `${day}T07:00:00.000Z`,
      completed_at: `${day}T07:30:00.000Z`,
    });
    expect(saved.exercises).toHaveLength(1);
    expect(saved.exercises[0].sets).toEqual([
      expect.objectContaining({ order_index: 1, status: "completed", reps: 5, weight_kg: 60 }),
      expect.objectContaining({ order_index: 2, status: "completed", reps: 5, weight_kg: 60 }),
    ]);
  });
});
