const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const { preparePage, waitForApp } = require("./server-helpers.cjs");

const APPLICATION_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
).origin;

async function setAccountLanguage(page, locale) {
  const request = page.context().request;
  const csrfResponse = await request.get(`${APPLICATION_ORIGIN}/api/v1/csrf-token`);
  expect(csrfResponse.ok()).toBe(true);
  const { csrfToken } = await csrfResponse.json();
  const response = await request.patch(`${APPLICATION_ORIGIN}/api/v1/users/me/preferences`, {
    data: { language: locale },
    headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).language).toBe(locale);
  const persisted = await request.get(`${APPLICATION_ORIGIN}/api/v1/users/me/preferences`);
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).language).toBe(locale);
}

const accessibilityPages = [
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
  { name: "Home", path: "/", requiresAuth: true },
  { name: "Calendar", path: "/calendar", requiresAuth: true },
  { name: "Library", path: "/library", requiresAuth: true },
  { name: "Dashboard", path: "/dashboard", requiresAuth: true },
  { name: "Settings", path: "/settings", requiresAuth: true },
];

const supportedLocales = ["en", "de", "es", "fr", "el"];
const cookieMessages = Object.fromEntries(
  supportedLocales.map((locale) => [
    locale,
    require(`../../../apps/frontend/src/i18n/locales/${locale}/cookie.json`),
  ]),
);

const localeMessages = Object.fromEntries(
  supportedLocales.map((locale) => [
    locale,
    require(`../../../apps/frontend/src/i18n/locales/${locale}/common.json`),
  ]),
);

const formatViolations = (violations) =>
  violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => node.target.filter(Boolean).join(" "))
        .filter(Boolean)
        .join(", ");
      return `${violation.id} (${violation.impact}) - ${violation.help}${
        nodes ? ` [${nodes}]` : ""
      }`;
    })
    .join("\n");

async function assertAccessible(page) {
  // Test the rendered state, not just the static route. No contrast exemptions or severity filtering.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

test.describe("Accessibility and localized UI acceptance", () => {
  for (const scenario of accessibilityPages) {
    test(`has no WCAG A/AA violations on ${scenario.name}`, async ({ page }) => {
      await preparePage(page, { authenticated: Boolean(scenario.requiresAuth) });
      await page.goto(scenario.path);
      await waitForApp(page);
      await page.locator("h1, h2, h3").first().waitFor({ state: "visible" });
      await assertAccessible(page);
    });
  }

  for (const locale of supportedLocales) {
    test(`workout creator rest-time controls are accessible and translated: ${locale}`, async ({ page }) => {
      const messages = localeMessages[locale];
      await preparePage(page, { authenticated: true });
      // Account preference is authoritative for signed-in users; test the persisted
      // preference through the real API rather than overriding browser storage.
      await setAccountLanguage(page, locale);
      await page.goto("/calendar");
      await waitForApp(page);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      // This scenario requires an unobstructed workout editor. Resolve actual
      // first-visit consent through the API-backed Reject All control rather
      // than hiding the dialog or bypassing its backend persistence.
      const cookieDialog = page.getByRole("dialog", {
        name: cookieMessages[locale].title,
      });
      if (await cookieDialog.isVisible()) {
        await cookieDialog.getByRole("button", {
          name: cookieMessages[locale].actions.rejectAll,
          exact: true,
        }).click();
        await expect(cookieDialog).toBeHidden();
      }
      const planButton = page.getByRole("button", {
        name: messages.calendarSurface.actions.plan,
        exact: true,
      });
      await planButton.click();

      const editor = page.getByRole("dialog", { name: messages.workoutEditor.title });
      await expect(editor).toBeVisible();
      const exerciseSelect = editor.getByRole("combobox", {
        name: messages.workoutEditor.fields.exercise,
        exact: true,
      });
      await expect.poll(async () => exerciseSelect.locator("option").count()).toBeGreaterThan(1);
      await exerciseSelect.selectOption({ index: 1 });
      await editor.getByRole("button", {
        name: messages.workoutEditor.actions.addExercise,
        exact: true,
      }).first().click();

      for (const [key, value] of [["restSet", "60"], ["restExercise", "120"]]) {
        const input = editor.getByRole("spinbutton", {
          name: messages.workoutEditor.fields[key],
          exact: true,
        });
        await expect(input).toBeVisible();
        await input.fill(value);
        await expect(input).toHaveValue(value);
      }

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await assertAccessible(page);
    });
  }
});
