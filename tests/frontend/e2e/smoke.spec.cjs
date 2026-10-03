const { test, expect } = require("@playwright/test");
const {
  TEST_USER,
  jsonResponse,
  loginUserBody,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
} = require("./helpers.cjs");

test("login page renders the FitVibe welcome heading", async ({ page }) => {
  await preparePage(page);
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("authenticated shell shows Home after login", async ({ page }) => {
  await preparePage(page);
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill(jsonResponse(loginUserBody(TEST_USER)));
  });

  await page.goto("/login");
  await waitForApp(page);
  await emailInput(page).fill(TEST_USER.email);
  await passwordInput(page).fill(TEST_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /home/i })).toBeVisible();
});
