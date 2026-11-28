// Test ownership: #489 (session lifecycle integration, replaced by #675).
// Session details against the real backend: open a planned workout from the
// Calendar, read its schedule and prescription, start it, reuse it as a private
// copy at a chosen time, and open a completed workout from Home's history.
const { test, expect } = require("./fixtures.cjs");
const {
  APPLICATION_ORIGIN,
  getCsrfToken,
  preparePage,
  retryRateLimitedMutation,
  waitForApp,
} = require("./server-helpers.cjs");
const {
  BASE_HOUR,
  DAY_MS,
  at,
  createPlannedSession,
  escapeRegExp,
  fetchSession,
  openCalendar,
  scheduleDays,
} = require("./schedule-helpers.cjs");
const {
  homeSurface,
  liveWorkout,
  sessionBlocks,
  sessionDetail,
  workoutEditor,
} = require("../../../apps/frontend/src/i18n/locales/en/common.json");

// Dates below are computed in UTC, so the browser renders the same calendar days.
test.use({ timezoneId: "UTC" });

// The planner specs use BASE_HOUR - 3 to BASE_HOUR + 3:35; this spec uses the minutes after.
const DETAIL_HOUR = BASE_HOUR + 3;

const withExercise = {
  exercises: [
    {
      order: 1,
      exercise_id: null,
      planned: { sets: 2, reps: 5, load: 60 },
      sets: [
        { order: 1, reps: 5, weight_kg: 60, rest_sec: 90 },
        { order: 2, reps: 5, weight_kg: 60, rest_sec: 90 },
      ],
    },
  ],
};

// ADR-046: one exercise as a Tabata interval block, eight rounds of 20 s work / 10 s rest.
const TABATA = { rounds: 8, work_sec: 20, rest_sec: 10 };
const withTabata = {
  exercises: [
    {
      order: 1,
      exercise_id: null,
      block_ref: 1,
      planned: { sets: TABATA.rounds },
      sets: Array.from({ length: TABATA.rounds }, (_, index) => ({
        order: index + 1,
        planned: { duration_sec: TABATA.work_sec, rest_sec: TABATA.rest_sec },
      })),
    },
  ],
  blocks: [{ ref: 1, kind: "interval", name: "Tabata", ...TABATA }],
};
const tabataSummary = [
  sessionBlocks.rounds_other.replace("{{count}}", TABATA.rounds),
  sessionBlocks.work.replace("{{value}}", TABATA.work_sec),
  sessionDetail.rest.replace("{{value}}", TABATA.rest_sec),
].join(" · ");

// The Calendar lists today's workouts under the selected day and in this week's plan.
const detailsButton = (page, title) =>
  page.getByRole("button", { name: `Details: ${title}`, exact: true }).first();

async function completeSession(page, sessionId) {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(request, "complete session");
  const response = await retryRateLimitedMutation(
    () =>
      request.patch(`${APPLICATION_ORIGIN}/api/v1/sessions/${sessionId}`, {
        data: { status: "completed" },
        headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
      }),
    "complete session",
  );
  expect(response.status()).toBe(200);
}

test.describe("Session details", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("open a planned workout from the Calendar, start it and reuse it as a private copy", async ({
    page,
  }, testInfo) => {
    // Several saves and checks in one scenario: allow twice the default budget.
    test.setTimeout(60_000);
    const { today } = scheduleDays();
    const title = `Detail ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, DETAIL_HOUR, 40),
      durationMin: 15,
      extra: withExercise,
    });
    await openCalendar(page);

    await detailsButton(page, title).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/^Scheduled: /)).toContainText(
      new RegExp(`${DETAIL_HOUR % 12 || 12}:40`),
    );
    await expect(page.getByText("Sets: 2 · Reps: 5 · Load: 60 kg")).toBeVisible();
    await expect(page.getByText("Reps: 5 · Load: 60 kg · Rest: 90 s")).toHaveCount(2);

    // Start: the server records the start and the live workout opens (ADR-043).
    await page.getByRole("button", { name: workoutEditor.actions.start, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${session.id}$`));
    const started = await fetchSession(page, session.id);
    expect(started.status).toBe("in_progress");
    expect(started.started_at).toBeTruthy();

    // Back on the session page, a workout in progress offers to continue.
    await page.goto(`/sessions/${session.id}`);
    await expect(
      page.getByRole("button", { name: liveWorkout.actions.continue, exact: true }),
    ).toBeVisible();

    // Reuse: a private, detached copy at the chosen time, which then opens.
    const copyAt = new Date(today.getTime() + 2 * DAY_MS + (DETAIL_HOUR * 60 + 50) * 60_000);
    await page.getByLabel(sessionDetail.reuseDate).fill(copyAt.toISOString().slice(0, 16));
    await page.getByRole("button", { name: sessionDetail.reuse, exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(`/sessions/${session.id}$`));
    const copyId = new URL(page.url()).pathname.split("/").pop();
    const copy = await fetchSession(page, copyId);
    expect(copy).toMatchObject({
      title,
      status: "planned",
      visibility: "private",
      plan_id: null,
      planned_duration_min: 15,
    });
    expect(new Date(copy.planned_at).toISOString()).toBe(copyAt.toISOString());
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(
      page.getByRole("button", { name: workoutEditor.actions.start, exact: true }),
    ).toBeVisible();
  });

  test("an interval block heads its exercises on the session page and in the live workout", async ({
    page,
  }, testInfo) => {
    const { today } = scheduleDays();
    const session = await createPlannedSession(page, {
      title: `Blocks ${testInfo.testId}`,
      plannedAt: at(today, DETAIL_HOUR, 5),
      durationMin: 10,
      extra: withTabata,
    });
    const stored = await fetchSession(page, session.id);
    expect(stored.blocks).toEqual([expect.objectContaining({ kind: "interval", ...TABATA })]);
    expect(stored.exercises[0].block_id).toBe(stored.blocks[0].id);
    expect(stored.exercises[0].sets).toHaveLength(TABATA.rounds);

    await page.goto(`/sessions/${session.id}`);
    await waitForApp(page);
    await expect(page.getByText("Tabata", { exact: true })).toBeVisible();
    await expect(page.getByText(sessionBlocks.kind.interval, { exact: true })).toBeVisible();
    await expect(page.getByText(tabataSummary, { exact: true })).toBeVisible();

    // Each round is a set, so the live workout records the block round by round.
    await page.getByRole("button", { name: workoutEditor.actions.start, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${session.id}$`));
    await expect(page.getByText(tabataSummary, { exact: true })).toBeVisible();
  });

  test("open a completed workout from Home's history, read-only", async ({ page }, testInfo) => {
    const { today } = scheduleDays();
    const title = `Done ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(new Date(today.getTime() - DAY_MS), DETAIL_HOUR, 55),
      extra: withExercise,
    });
    await completeSession(page, session.id);

    await page.goto("/");
    await waitForApp(page);
    await detailsButton(page, title).click();

    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}$`));
    await expect(page.getByText(sessionDetail.completed, { exact: true })).toBeVisible();
    await expect(page.getByText(/^Completed: /)).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(
          `^(${escapeRegExp(sessionDetail.pointsPending)}|${homeSurface.session.points.replace(
            "{{count}}",
            "\\d+",
          )})$`,
        ),
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: workoutEditor.actions.start, exact: true }),
    ).toHaveCount(0);
  });
});
