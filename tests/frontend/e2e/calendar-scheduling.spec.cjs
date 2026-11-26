// Test ownership: #86 (US-4.3), #87 (US-4.4), #139 (US-13.3).
// Planner scheduling against the real backend: drag-and-drop in the month, week
// and day views, keyboard pick-up, resizing, the reschedule dialog, client and
// server overlap handling, touch dragging and resizing on a narrow viewport, and
// the timing evidence the acceptance criteria ask for.
const { test, expect } = require("./fixtures.cjs");
const {
  APPLICATION_ORIGIN,
  getCsrfToken,
  preparePage,
  trackRequests,
} = require("./server-helpers.cjs");
const {
  BASE_HOUR,
  at,
  createPlannedSession,
  dayKey,
  durationOf,
  escapeRegExp,
  openCalendar,
  pad,
  plannedAtOf,
  scheduleDays,
  slotCell,
  switchView,
} = require("./schedule-helpers.cjs");
const { calendarSurface } = require("../../../apps/frontend/src/i18n/locales/en/common.json");

// Dates below are computed in UTC, so the browser renders the same calendar days.
test.use({ timezoneId: "UTC" });

const RE_RENDER_BUDGET_MS = 150; // US-4.3-AC01
const LONG_TASK_MS = 50; // US-4.4-AC01

const dayCell = (page, date) => page.locator(`[data-schedule-day="${dayKey(date)}"]`);
const cardHandle = (page, title) =>
  page.getByRole("button", { name: `Move ${title}`, exact: true }).first();
const chip = (page, title) =>
  page.getByRole("button", { name: new RegExp(`${escapeRegExp(title)}, move$`) });
const resizeHandle = (page, title) =>
  page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(title)}, ends .*, change length$`),
  });
const moveStatus = (page, title) =>
  page
    .getByRole("status")
    .filter({ hasText: new RegExp(`^${escapeRegExp(title)} is now planned for`) });

const centerOf = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Whether the centre of `locator` is what the pointer would hit (not clipped or covered). */
async function receivesPointer(locator) {
  const box = await locator.boundingBox();
  if (!box) {
    return false;
  }
  return locator.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return Boolean(hit && element.contains(hit));
  }, centerOf(box));
}

/**
 * Presses `from`, then moves to `to` without releasing. A trial click first scrolls the
 * source into view and checks it receives the press. A target the pointer cannot reach
 * yet is brought into view the way a user would: by resting at the window edge, which
 * auto-scrolls the calendar.
 */
async function mouseDrag(page, from, to) {
  await from.click({ trial: true });
  const start = centerOf(await from.boundingBox());
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (!(await receivesPointer(to))) {
    const { height } = page.viewportSize();
    const targetBox = await to.boundingBox();
    await page.mouse.move(start.x, targetBox && targetBox.y < start.y ? 4 : height - 4, {
      steps: 8,
    });
    await expect.poll(() => receivesPointer(to)).toBe(true);
    await page.mouse.move(start.x, height / 2, { steps: 4 });
  }
  const end = centerOf(await to.boundingBox());
  await page.mouse.move(end.x, end.y, { steps: 12 });
}

test.describe("Calendar scheduling", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("month view: drag a workout to another day, keeping its time, within the re-render budget", async ({
    page,
  }, testInfo) => {
    const { today, otherDay } = scheduleDays();
    const title = `Drag month ${testInfo.testId}`;
    const session = await createPlannedSession(page, { title, plannedAt: at(today, BASE_HOUR, 3) });
    await openCalendar(page);

    await mouseDrag(page, cardHandle(page, title), dayCell(page, otherDay));
    await expect(dayCell(page, otherDay)).toHaveClass(/calendar-month__cell--drop-target/);

    // Time from the pointer release to the target day's re-render (its workout count changes).
    await page.evaluate((key) => {
      const label = document.querySelector(`[data-schedule-day="${key}"] button`);
      const before = label.getAttribute("aria-label");
      window.__calendarMove = {};
      window.addEventListener(
        "pointerup",
        () => {
          window.__calendarMove.released = performance.now();
        },
        { capture: true, once: true },
      );
      const observer = new MutationObserver(() => {
        if (label.getAttribute("aria-label") !== before) {
          window.__calendarMove.rendered = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(label, { attributes: true, attributeFilter: ["aria-label"] });
    }, dayKey(otherDay));
    const navigations = trackRequests(page, (request) => request.isNavigationRequest());
    await page.mouse.up();

    await expect(moveStatus(page, title)).toBeVisible();
    navigations.stop();
    expect(navigations.requests, "no page reload").toHaveLength(0);
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(otherDay, BASE_HOUR, 3).toISOString());

    const timing = await page.evaluate(() => window.__calendarMove);
    const elapsed = timing.rendered - timing.released;
    await testInfo.attach("re-render-timing.json", {
      body: JSON.stringify({ elapsedMs: elapsed, budgetMs: RE_RENDER_BUDGET_MS }),
      contentType: "application/json",
    });
    expect(elapsed).toBeLessThanOrEqual(RE_RENDER_BUDGET_MS);
  });

  test("conflicts are refused before saving, and the server re-validates with 422", async ({
    page,
  }, testInfo) => {
    const { today, otherDay } = scheduleDays();
    const moving = `Conflict mover ${testInfo.testId}`;
    const blocking = `Conflict blocker ${testInfo.testId}`;
    const mover = await createPlannedSession(page, {
      title: moving,
      plannedAt: at(today, BASE_HOUR, 11),
    });
    const blocker = await createPlannedSession(page, {
      title: blocking,
      plannedAt: at(otherDay, BASE_HOUR, 11),
    });
    await openCalendar(page);

    const writes = trackRequests(
      page,
      (request) => request.method() === "PATCH" && request.url().includes("/api/v1/sessions/"),
    );
    await mouseDrag(page, cardHandle(page, moving), dayCell(page, otherDay));
    await expect(dayCell(page, otherDay)).toHaveClass(/calendar-month__cell--conflict/);
    await page.mouse.up();

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${escapeRegExp(blocking)} is planned from`) }),
    ).toBeVisible();
    writes.stop();
    expect(writes.requests, "client refused the move before any request").toHaveLength(0);

    // US-4.3-AC03: the server rejects the same move on its own.
    const csrfToken = await getCsrfToken(page.context().request, "conflict check");
    const response = await page
      .context()
      .request.patch(`${APPLICATION_ORIGIN}/api/v1/sessions/${mover.id}`, {
        data: { planned_at: at(otherDay, BASE_HOUR, 11).toISOString() },
        headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
      });
    const body = await response.json();
    await testInfo.attach("schedule-conflict-response.json", {
      body: JSON.stringify({ status: response.status(), body }, null, 2),
      contentType: "application/json",
    });
    expect(response.status()).toBe(422);
    expect(body.error.code).toBe("E.SESSION.SCHEDULE_CONFLICT");
    expect(body.error.details.conflictingSessionIds).toEqual([blocker.id]);
    expect(await plannedAtOf(page, mover.id)).toBe(at(today, BASE_HOUR, 11).toISOString());
  });

  test("keyboard: Space picks up, arrow keys move, Enter drops (month view)", async ({
    page,
  }, testInfo) => {
    const { today, otherDay } = scheduleDays();
    const title = `Keyboard month ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR, 19),
    });
    await openCalendar(page);

    const handle = cardHandle(page, title);
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: `${title} picked up` })).toBeVisible();
    await page.keyboard.press(otherDay < today ? "ArrowLeft" : "ArrowRight");
    await expect(dayCell(page, otherDay)).toHaveClass(/calendar-month__cell--drop-target/);
    await page.keyboard.press("Enter");

    await expect(moveStatus(page, title)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(otherDay, BASE_HOUR, 19).toISOString());
  });

  test("week and day views place workouts in time slots and accept slot moves", async ({
    page,
  }, testInfo) => {
    const { today } = scheduleDays();
    const title = `Week slot ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR, 27),
    });
    await openCalendar(page);

    await switchView(page, calendarSurface.views.week);
    const week = page.getByRole("table", { name: calendarSurface.timeGrid.weekLabel });
    await expect(week).toBeVisible();
    await expect(week.getByRole("columnheader")).toHaveCount(8);
    await expect(slotCell(page, today, BASE_HOUR).getByText(title)).toBeVisible();

    // Pointer: drop three hours earlier, keeping the minutes.
    await chip(page, title).scrollIntoViewIfNeeded();
    await mouseDrag(page, chip(page, title), slotCell(page, today, BASE_HOUR - 3));
    await expect(slotCell(page, today, BASE_HOUR - 3)).toHaveClass(
      /schedule-time-grid__slot--drop-target/,
    );
    await page.mouse.up();
    await expect(moveStatus(page, title)).toBeVisible();
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(today, BASE_HOUR - 3, 27).toISOString());

    // Keyboard: one hour later, and focus returns to the moved chip.
    await chip(page, title).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(today, BASE_HOUR - 2, 27).toISOString());
    await expect(chip(page, title)).toBeFocused();

    await switchView(page, calendarSurface.views.day);
    const day = page.getByRole("table", { name: calendarSurface.timeGrid.dayLabel });
    await expect(day.getByRole("columnheader")).toHaveCount(2);
    await expect(slotCell(page, today, BASE_HOUR - 2).getByText(title)).toBeVisible();
  });

  test("week view: resize a workout by dragging or with the keyboard; overlaps are refused", async ({
    page,
  }, testInfo) => {
    const { today } = scheduleDays();
    // Several saves and checks in one scenario: allow twice the default budget.
    test.setTimeout(60_000);
    const title = `Resize ${testInfo.testId}`;
    const blocking = `Resize blocker ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR, 51),
    });
    await createPlannedSession(page, { title: blocking, plannedAt: at(today, BASE_HOUR + 2, 10) });
    await openCalendar(page);
    await switchView(page, calendarSurface.views.week);

    // Pointer: drop the end on the next hour, so the workout ends where that hour ends.
    await mouseDrag(page, resizeHandle(page, title), slotCell(page, today, BASE_HOUR + 1));
    await expect(slotCell(page, today, BASE_HOUR + 1)).toHaveClass(
      /schedule-time-grid__slot--drop-target/,
    );
    await page.mouse.up();
    await expect(moveStatus(page, title)).toBeVisible();
    await expect.poll(() => durationOf(page, session.id)).toBe(69);
    await expect(
      slotCell(page, today, BASE_HOUR + 1).locator(".schedule-chip-continuation"),
    ).toHaveCount(1);

    // Ending an hour later would run into the blocker: previewed, then refused without a request.
    const writes = trackRequests(
      page,
      (request) => request.method() === "PATCH" && request.url().includes("/api/v1/sessions/"),
    );
    await mouseDrag(page, resizeHandle(page, title), slotCell(page, today, BASE_HOUR + 2));
    await expect(slotCell(page, today, BASE_HOUR + 2)).toHaveClass(
      /schedule-time-grid__slot--conflict/,
    );
    await page.mouse.up();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${escapeRegExp(blocking)} is planned from`) }),
    ).toBeVisible();
    writes.stop();
    expect(writes.requests, "client refused the resize before any request").toHaveLength(0);
    expect(await durationOf(page, session.id)).toBe(69);

    // Keyboard: Space, one step shorter, Enter; focus stays on the resize handle.
    await resizeHandle(page, title).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("status").filter({ hasText: `Changing the length of ${title}` }),
    ).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect.poll(() => durationOf(page, session.id)).toBe(54);
    await expect(resizeHandle(page, title)).toBeFocused();
  });

  test("the reschedule dialog sets a new day, time and length without dragging", async ({
    page,
  }, testInfo) => {
    const { today, otherDay } = scheduleDays();
    const title = `Dialog move ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR, 35),
    });
    await openCalendar(page);

    await cardHandle(page, title).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: calendarSurface.schedule.dialog.title });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(calendarSurface.schedule.fields.day).fill(dayKey(otherDay));
    await dialog.getByLabel(calendarSurface.schedule.fields.time).fill(`${pad(BASE_HOUR + 1)}:45`);
    await dialog.getByLabel(calendarSurface.schedule.fields.duration).fill("20");
    await dialog.getByRole("button", { name: calendarSurface.schedule.actions.save }).click();

    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(otherDay, BASE_HOUR + 1, 45).toISOString());
    expect(await durationOf(page, session.id)).toBe(20);
  });
});

test.describe("Calendar scheduling on a touch device (US-4.4)", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 780 } });

  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("touch drag reaches an off-screen day by edge auto-scroll, without long tasks", async ({
    page,
  }, testInfo) => {
    const { today, otherDay } = scheduleDays();
    const title = `Touch drag ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR, 43),
    });
    await openCalendar(page);

    const handle = cardHandle(page, title);
    const target = dayCell(page, otherDay);
    await handle.scrollIntoViewIfNeeded();
    await expect(handle).toBeInViewport();
    const from = await handle.boundingBox();

    await page.evaluate(() => {
      window.__touchDrag = { longTasks: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (window.__touchDrag.recording) {
            window.__touchDrag.longTasks.push(Math.round(entry.duration));
          }
        }
      }).observe({ type: "longtask" });
    });

    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }],
      });
    const slide = async (fromPoint, toPoint, steps = 12) => {
      for (let index = 1; index <= steps; index += 1) {
        await touch(
          "touchMove",
          fromPoint.x + ((toPoint.x - fromPoint.x) * index) / steps,
          fromPoint.y + ((toPoint.y - fromPoint.y) * index) / steps,
        );
      }
    };

    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    await touch("touchStart", start.x, start.y);
    await page.evaluate(() => {
      window.__touchDrag.recording = true;
    });
    // Rest the finger at the top edge: the calendar scrolls until the target day shows.
    const edge = { x: start.x, y: 8 };
    await slide(start, edge);
    await expect(target).toBeInViewport({ ratio: 1 });
    // Leave the edge zone so scrolling stops, then aim at the day where it settled.
    const rest = { x: start.x, y: page.viewportSize().height / 2 };
    await slide(edge, rest, 4);
    await expect(target).toBeInViewport({ ratio: 1 });
    const to = await target.boundingBox();
    await slide(rest, { x: to.x + to.width / 2, y: to.y + to.height / 2 });
    await expect(target).toHaveClass(/calendar-month__cell--drop-target/);
    const longTasks = await page.evaluate(() => {
      window.__touchDrag.recording = false;
      return window.__touchDrag.longTasks;
    });
    await touch("touchEnd");

    await testInfo.attach("touch-drag-performance.json", {
      body: JSON.stringify({ longTasksDuringDrag: longTasks, budgetMs: LONG_TASK_MS }),
      contentType: "application/json",
    });
    expect(longTasks.filter((duration) => duration > LONG_TASK_MS)).toEqual([]);
    await expect(moveStatus(page, title)).toBeVisible();
    await expect
      .poll(() => plannedAtOf(page, session.id))
      .toBe(at(otherDay, BASE_HOUR, 43).toISOString());
  });
  test("touch: drag the resize handle in the day view", async ({ page }, testInfo) => {
    const { today } = scheduleDays();
    const title = `Touch resize ${testInfo.testId}`;
    const session = await createPlannedSession(page, {
      title,
      plannedAt: at(today, BASE_HOUR - 1, 30),
    });
    await openCalendar(page);
    await switchView(page, calendarSurface.views.day);

    const handle = resizeHandle(page, title);
    await handle.scrollIntoViewIfNeeded();
    await expect(handle).toBeInViewport();
    const from = await handle.boundingBox();
    const target = await slotCell(page, today, BASE_HOUR - 1).boundingBox();

    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }],
      });
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    // The finger travels up past the drag threshold, then back down to the slot's lower
    // edge: dropped inside the starting hour, the workout ends where that hour ends.
    const lift = { x: start.x, y: Math.max(target.y + 2, start.y - 24) };
    const end = { x: start.x, y: target.y + target.height - 4 };
    await touch("touchStart", start.x, start.y);
    for (const [segmentStart, segmentEnd] of [
      [start, lift],
      [lift, end],
    ]) {
      for (let index = 1; index <= 4; index += 1) {
        await touch(
          "touchMove",
          segmentStart.x + ((segmentEnd.x - segmentStart.x) * index) / 4,
          segmentStart.y + ((segmentEnd.y - segmentStart.y) * index) / 4,
        );
      }
    }
    await expect(page.locator(".schedule-chip--resizing")).toHaveCount(1);
    await touch("touchEnd");

    await expect(moveStatus(page, title)).toBeVisible();
    await expect.poll(() => durationOf(page, session.id)).toBe(30);
  });
});
