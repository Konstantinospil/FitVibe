const { test, expect } = require("@playwright/test");
const {
  TEST_USER,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
} = require("./server-helpers.cjs");

test("login page renders the FitVibe welcome heading", async ({ page }) => {
  await preparePage(page);
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("authenticated shell shows Home after real login", async ({ page }) => {
  await preparePage(page);
  await page.goto("/login");
  await waitForApp(page);
  await emailInput(page).fill(TEST_USER.email);
  await passwordInput(page).fill(TEST_USER.password);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await loginResponse).ok()).toBeTruthy();
  await page.waitForURL((url) => url.pathname === "/");

  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /home/i })).toBeVisible();
});
