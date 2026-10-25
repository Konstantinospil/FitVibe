const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const {
  preparePage,
  prepareFirstLoginState,
  createFirstLoginAccount,
  ensureSeededOnboardingComplete,
  ensureEssentialCookieConsent,
  setAccountLanguage,
  waitForApp,
} = require("./server-helpers.cjs");

const APPLICATION_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
).origin;

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
  let athleteAccount;
  test.beforeAll(async ({ browser }) => {
    const setupPage = await browser.newPage();
    try {
      athleteAccount = await createFirstLoginAccount(setupPage, {
        testId: "axe-suite-athlete", retry: 0, repeatEachIndex: 0,
      });
      await ensureSeededOnboardingComplete(setupPage);
    } finally {
      await setupPage.close();
    }
  });
  // The real consent API can require a full rate-limit recovery window.
  test.describe.configure({ timeout: 120_000 });
  for (const scenario of accessibilityPages) {
    test(`has no WCAG A/AA violations on ${scenario.name}`, async ({ page }) => {
      await preparePage(page, {
        authenticated: Boolean(scenario.requiresAuth),
        account: athleteAccount,
      });
      await page.goto(scenario.path);
      await waitForApp(page);
      await page.locator("h1, h2, h3").first().waitFor({ state: "visible" });
      await assertAccessible(page);
    });
  }

  for (const locale of supportedLocales) {
    test(`workout creator rest-time controls are accessible and translated: ${locale}`, async ({ page }, testInfo) => {
      const messages = localeMessages[locale];
      // Use a unique account per locale so fully-parallel shards cannot race on
      // the seeded administrator's persisted language preference.
      await prepareFirstLoginState(page, testInfo);
      await setAccountLanguage(page, locale);
      await ensureEssentialCookieConsent(page);
      await page.goto("/calendar");
      await waitForApp(page);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      // The seeded account may display its real first-login 2FA invitation.
      // Dismiss it through the supported UI/API, before opening the workout editor.
      const onboarding = page.locator("[data-onboarding-2fa-stage]");
      await expect(onboarding).toHaveAttribute("data-onboarding-2fa-stage", /^(choice|done)$/);
      if ((await onboarding.getAttribute("data-onboarding-2fa-stage")) === "choice") {
        const invitation = page.getByRole("dialog", {
          name: messages.firstLogin2fa.title,
        });
        await expect(invitation).toBeVisible();
        const dismissal = page.waitForResponse((response) =>
          new URL(response.url()).pathname === "/api/v1/auth/2fa/invitation/dismiss" &&
          response.request().method() === "POST",
        );
        await invitation.getByRole("button", {
          name: messages.firstLogin2fa.notNow,
          exact: true,
        }).click();
        expect((await dismissal).ok()).toBe(true);
        await expect(onboarding).toHaveAttribute("data-onboarding-2fa-stage", "done");
        await expect(invitation).toBeHidden();
      }
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
