const { test, expect } = require("@playwright/test");
const {
  jsonResponse,
  SEEDED_USER,
  preparePage,
  prepareRealPage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
} = require("./helpers.cjs");

const loginPayload = {
  email: SEEDED_USER.email,
  password: SEEDED_USER.password,
};

async function focusByTab(page, locator, maxTabs = 50) {
  await locator.waitFor({ state: "visible" });
  for (let i = 0; i < maxTabs; i += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Unable to focus locator via keyboard navigation.");
}

test.describe("Keyboard-only flows on active surfaces", () => {
  test("user can complete login with keyboard navigation", async ({ page }) => {
    await prepareRealPage(page);
    await page.goto("/login");
    await waitForApp(page);
    await focusByTab(page, emailInput(page));
    await page.keyboard.type(loginPayload.email);
    await focusByTab(page, passwordInput(page));
    await page.keyboard.type(loginPayload.password);
    await focusByTab(page, page.getByRole("button", { name: /sign in/i }));
    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
    );
    await page.keyboard.press("Enter");
    expect((await loginResponse).ok()).toBeTruthy();

    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  });

  test("user can register with keyboard-accessible controls", async ({ page }) => {
    await preparePage(page);
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill(jsonResponse({ message: "accepted" }, 202));
    });

    await page.goto("/register");
    await waitForApp(page);
    await focusByTab(page, displayNameInput(page));
    await page.keyboard.type("Jamie Carter");
    await focusByTab(page, emailInput(page));
    await page.keyboard.type(loginPayload.email);
    await page.locator("form input[name='username']").fill("jamie");
    await focusByTab(page, passwordInput(page));
    await page.keyboard.type(loginPayload.password);
    await focusByTab(page, confirmPasswordInput(page));
    await page.keyboard.type(loginPayload.password);
    const legalCheckboxes = page.getByRole("checkbox");
    for (let index = 0; index < 2; index += 1) {
      await focusByTab(page, legalCheckboxes.nth(index));
      await page.keyboard.press("Space");
      await expect(legalCheckboxes.nth(index)).toBeChecked();
    }
    await focusByTab(page, page.getByRole("button", { name: /create account/i }));
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  });

  test("current application navigation is keyboard reachable", async ({ page }) => {
    await prepareRealPage(page);
    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(SEEDED_USER.email);
    await passwordInput(page).fill(SEEDED_USER.password);
    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    expect((await loginResponse).ok()).toBeTruthy();
    await page.waitForURL((url) => url.pathname === "/");
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
