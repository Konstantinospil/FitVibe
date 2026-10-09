const { test, expect } = require("./fixtures.cjs");
const {
  TEST_USER,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
} = require("./server-helpers.cjs");

async function focusByTab(page, locator, maxTabs = 50) {
  await locator.waitFor({ state: "visible" });
  for (let i = 0; i < maxTabs; i += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Unable to focus locator via keyboard navigation.");
}

test.describe("Keyboard-only flows on active surfaces", () => {
  test("user can complete real login with keyboard navigation", async ({ page }) => {
    await preparePage(page);
    await page.goto("/login");
    await waitForApp(page);
    await focusByTab(page, emailInput(page));
    await page.keyboard.type(TEST_USER.email);
    await focusByTab(page, passwordInput(page));
    await page.keyboard.type(TEST_USER.password);
    await focusByTab(page, page.getByRole("button", { name: /sign in/i }));

    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/login") &&
        response.request().method() === "POST",
    );
    await page.keyboard.press("Enter");
    expect((await loginResponse).ok()).toBeTruthy();

    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  });

  test("user can register with keyboard-accessible controls against the real server", async ({ page }, testInfo) => {
    await preparePage(page);

    const suffix = `${testInfo.workerIndex}-${testInfo.retry}`;
    const email = `keyboard.e2e.${suffix}@fitvibe.test`;
    const username = `keyboard.e2e.${suffix}`;
    const password = "SuperSecure123!";

    await page.goto("/register");
    await waitForApp(page);
    await focusByTab(page, displayNameInput(page));
    await page.keyboard.type("Jamie Carter");
    await focusByTab(page, emailInput(page));
    await page.keyboard.type(email);
    await page.locator("form input[name='username']").fill(username);
    await focusByTab(page, passwordInput(page));
    await page.keyboard.type(password);
    await focusByTab(page, confirmPasswordInput(page));
    await page.keyboard.type(password);

    const legalCheckboxes = page.getByRole("checkbox");
    for (let index = 0; index < 2; index += 1) {
      await focusByTab(page, legalCheckboxes.nth(index));
      await page.keyboard.press("Space");
      await expect(legalCheckboxes.nth(index)).toBeChecked();
    }

    await focusByTab(page, page.getByRole("button", { name: /create account/i }));
    const registrationResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/register") &&
        response.request().method() === "POST",
    );
    await page.keyboard.press("Enter");

    expect((await registrationResponse).status()).toBe(202);
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  });

  test("current application navigation is keyboard reachable with a real session", async ({ page }) => {
    await preparePage(page, { authenticated: true });
    await page.goto("/");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();

    const calendar = page.getByRole("link", { name: /^calendar$/i });
    await focusByTab(page, calendar);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/calendar");
    await expect(page.getByRole("heading", { name: /^calendar$/i, level: 1 })).toBeVisible();

    const library = page.getByRole("link", { name: /^library$/i });
    await focusByTab(page, library);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/library");
    await expect(page.getByRole("heading", { name: /^library$/i, level: 1 })).toBeVisible();
  });
});
