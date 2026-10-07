const { test, expect } = require("@playwright/test");
const {
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
} = require("./server-helpers.cjs");

const registerPayload = {
  password: "SuperSecure123!",
  name: "Jamie Carter",
};

test("user can register, verify, login, and reach the current Calendar surface", async ({ page }, testInfo) => {
  await preparePage(page);

  const suffix = `${testInfo.workerIndex}-${testInfo.retry}`;
  const email = `onboarding.e2e.${suffix}@fitvibe.test`;
  const username = `onboarding.e2e.${suffix}`;

  await page.goto("/register");
  await waitForApp(page);
  await displayNameInput(page).fill(registerPayload.name);
  await emailInput(page).fill(email);
  await page.locator("form input[name='username']").fill(username);
  await passwordInput(page).fill(registerPayload.password);
  await confirmPasswordInput(page).fill(registerPayload.password);
  await acceptRegisterLegal(page);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/register") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /create account/i }).click();

  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(202);
  const registrationBody = await registrationResponse.json();
  expect(registrationBody.debugVerificationToken).toEqual(expect.any(String));

  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();

  await page.goto(`/verify?token=${encodeURIComponent(registrationBody.debugVerificationToken)}`);
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();
  await page.getByRole("button", { name: /go to login/i }).click();
  await page.waitForURL("**/login");

  await emailInput(page).fill(email);
  await passwordInput(page).fill(registerPayload.password);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await loginResponsePromise).ok()).toBeTruthy();

  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();

  await page.getByRole("link", { name: /^calendar$/i }).click();
  await page.waitForURL((url) => url.pathname === "/calendar");
  await expect(page.getByRole("heading", { name: /^calendar$/i, level: 1 })).toBeVisible();
});
