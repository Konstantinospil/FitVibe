const { test, expect } = require("@playwright/test");
const {
  jsonResponse,
  loginUserBody,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
} = require("./helpers.cjs");

const registerPayload = {
  email: "jamie@fitvibe.test",
  password: "SuperSecure123!",
  name: "Jamie Carter",
};

test("user can register, login, and reach the current Calendar surface", async ({ page }) => {
  await preparePage(page);

  await page.route("**/api/v1/auth/register", async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}");
    expect(payload).toMatchObject({
      email: registerPayload.email,
      password: registerPayload.password,
      username: "jamie",
      profile: { display_name: registerPayload.name },
    });
    await route.fulfill(jsonResponse({ message: "accepted" }, 202));
  });

  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill(
      jsonResponse(
        loginUserBody({
          id: "user-123",
          email: registerPayload.email,
          username: "jamie",
          role: "athlete",
        }),
      ),
    );
  });

  await page.goto("/register");
  await waitForApp(page);
  await displayNameInput(page).fill(registerPayload.name);
  await emailInput(page).fill(registerPayload.email);
  await passwordInput(page).fill(registerPayload.password);
  await confirmPasswordInput(page).fill(registerPayload.password);
  await acceptRegisterLegal(page);

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/api/v1/auth/register") && response.request().method() === "POST",
    ),
    page.getByRole("button", { name: /create account/i }).click(),
  ]);

  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  await page.getByRole("link", { name: /go to login/i }).click();
  await page.waitForURL("**/login");

  await emailInput(page).fill(registerPayload.email);
  await passwordInput(page).fill(registerPayload.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();

  await page.getByRole("link", { name: /^calendar$/i }).click();
  await page.waitForURL((url) => url.pathname === "/calendar");
  await expect(page.getByRole("heading", { name: /^calendar$/i, level: 1 })).toBeVisible();
});
