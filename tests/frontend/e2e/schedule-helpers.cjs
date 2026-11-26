// Shared by the planner E2E specs: calendar dates in UTC, a quiet hour to schedule
// around, and API helpers for planned sessions on the worker's athlete account.
const { expect } = require("./fixtures.cjs");
const {
  APPLICATION_ORIGIN,
  getCsrfToken,
  retryRateLimitedMutation,
  waitForApp,
} = require("./server-helpers.cjs");
const { calendarSurface } = require("../../../apps/frontend/src/i18n/locales/en/common.json");

const DAY_MS = 86_400_000;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pad = (value) => String(value).padStart(2, "0");
const dayKey = (date) => date.toISOString().slice(0, 10);
const slotKey = (date, hour) => `${dayKey(date)}T${pad(hour)}`;

const utcMidnight = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const at = (day, hour, minute) => new Date(day.getTime() + (hour * 60 + minute) * 60_000);

/** Today and another day of the same Monday-first week, so every view shows both. */
const scheduleDays = () => {
  const today = utcMidnight(new Date());
  const isMonday = today.getUTCDay() === 1;
  return { today, otherDay: new Date(today.getTime() + (isMonday ? 1 : -1) * DAY_MS) };
};

/**
 * The hour the planner specs schedule around: the hour between 09:00 and 19:00 UTC
 * that is furthest from now. Other specs on the worker's account create workouts
 * "now" or at midnight, and sessions occupy time, so these specs stay well clear of
 * both. The calendar spec uses three hours before to two hours after it, and the
 * planner workflow the third hour after it: all inside the week view's default
 * 06:00–22:00 rows, so every target slot is on screen.
 */
const BASE_HOUR = (() => {
  const now = new Date().getUTCHours();
  const distance = (hour) => Math.min(Math.abs(hour - now), 24 - Math.abs(hour - now));
  let best = 9;
  for (let hour = 9; hour <= 19; hour += 1) {
    if (distance(hour) > distance(best)) {
      best = hour;
    }
  }
  return best;
})();

// Test workouts last a few minutes; every test uses its own minute, so sessions left
// by other tests on the worker's account never overlap.
const TEST_DURATION_MIN = 5;

/** Creates a planned session for the signed-in athlete; `extra` adds API fields. */
async function createPlannedSession(
  page,
  { title, plannedAt, durationMin = TEST_DURATION_MIN, extra = {} },
) {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(request, "planned session");
  const response = await retryRateLimitedMutation(
    () =>
      request.post(`${APPLICATION_ORIGIN}/api/v1/sessions`, {
        data: {
          title,
          planned_at: plannedAt.toISOString(),
          planned_duration_min: durationMin,
          ...extra,
        },
        headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
      }),
    "create planned session",
  );
  expect(response.status(), "planned session created").toBe(201);
  return response.json();
}

async function fetchSession(page, sessionId) {
  const response = await page
    .context()
    .request.get(`${APPLICATION_ORIGIN}/api/v1/sessions/${sessionId}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

const plannedAtOf = async (page, sessionId) =>
  new Date((await fetchSession(page, sessionId)).planned_at).toISOString();

const durationOf = async (page, sessionId) =>
  (await fetchSession(page, sessionId)).planned_duration_min;

async function openCalendar(page) {
  await page.goto("/calendar");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: calendarSurface.title, level: 1 })).toBeVisible();
}

const slotCell = (page, date, hour) => page.locator(`[data-schedule-day="${slotKey(date, hour)}"]`);

async function switchView(page, label) {
  const views = page.getByRole("group", { name: calendarSurface.views.label });
  await views.getByRole("button", { name: label, exact: true }).click();
  await expect(views.getByRole("button", { name: label, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

module.exports = {
  BASE_HOUR,
  DAY_MS,
  at,
  createPlannedSession,
  dayKey,
  durationOf,
  escapeRegExp,
  fetchSession,
  openCalendar,
  pad,
  plannedAtOf,
  scheduleDays,
  slotCell,
  switchView,
};
