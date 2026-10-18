const { test, expect } = require("./fixtures.cjs");
const { observeMutation } = require("./request-observer.cjs");
const { createRequire } = require("node:module");
const path = require("node:path");
const backendRequire = createRequire(path.resolve(__dirname, "../../../apps/backend/package.json"));
const { authenticator } = backendRequire("@otplib/preset-default");
const {
  preparePage,
  trackRequests,
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

test("registration, Terms, email verification, 2FA and logout", async ({ page }, testInfo) => {
  await preparePage(page);

  const suffix = `${testInfo.workerIndex}-${testInfo.retry}`;
  const email = `onboarding.e2e.${suffix}@fitvibe.test`;
  const username = `onboarding.e2e.${suffix}`;

  await page.goto("/register");
  await waitForApp(page);
  await displayNameInput(page).fill(registerPayload.name);
  await page.getByRole("spinbutton", { name: /weight/i }).fill("75");
  await page.getByLabel(/date of birth/i).fill("2000-01-15");
  await page.getByRole("combobox", { name: /^gender$/i }).selectOption("prefer_not_to_say");
  await page
    .getByRole("combobox", { name: /current activity intensity/i })
    .selectOption("intermediate");
  await emailInput(page).fill(email);
  await page.locator("form input[name='username']").fill(username);
  // Detect frontend controlled-input races before exercising server persistence.
  await expect(page.locator("form input[name='username']")).toHaveValue(username);
  await passwordInput(page).fill(registerPayload.password);
  await confirmPasswordInput(page).fill(registerPayload.password);

  // The real registration form must reject an unconsented submission.
  const rejectedSubmission = trackRequests(
    page,
    (request) =>
      new URL(request.url()).pathname === "/api/v1/auth/register" &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(
    page.locator("form [data-component='form-feedback'][data-tone='danger']"),
  ).toContainText(/accept the Terms and Conditions and Privacy Policy/i);
  expect(rejectedSubmission.requests).toHaveLength(0);
  rejectedSubmission.stop();

  await acceptRegisterLegal(page);
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await expect(checkbox).toBeChecked();
  }

  const registrationMutation = observeMutation(page, "POST", "/api/v1/auth/register");
  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/register") &&
      response.request().method() === "POST",
  );
  await expect(page.locator("form input[name='username']")).toHaveValue(username);
  await page.getByRole("button", { name: /create account/i }).click();

  const registrationResponse = await registrationResponsePromise;
  // Assert the browser submitted the intended username, not just HTTP 202.
  const submittedRegistration = registrationResponse.request().postDataJSON();
  expect(submittedRegistration.username).toBe(username);
  expect(registrationResponse.status()).toBe(202);
  const registrationBody = await registrationResponse.json();
  expect(registrationBody.debugVerificationToken).toEqual(expect.any(String));

  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  registrationMutation.assertExactlyOnce(202);
  registrationMutation.stop();

  await page.goto(`/verify?token=${encodeURIComponent(registrationBody.debugVerificationToken)}`);
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();
  await page.getByRole("button", { name: /go to login/i }).click();
  await page.waitForURL("**/login");

  await emailInput(page).fill(email);
  await passwordInput(page).fill(registerPayload.password);
  const loginMutation = observeMutation(page, "POST", "/api/v1/auth/login");
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await loginResponsePromise).ok()).toBeTruthy();

  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  loginMutation.assertExactlyOnce(200);
  loginMutation.stop();

  const origin = new URL(page.url()).origin;
  const profileResponse = await page.context().request.get(`${origin}/api/v1/users/me`);
  expect(profileResponse.status()).toBe(200);
  expect(await profileResponse.json()).toMatchObject({ primaryEmail: email, username });

  const legalResponse = await page.context().request.get(
    `${origin}/api/v1/auth/legal-documents/status`,
  );
  expect(legalResponse.status()).toBe(200);
  expect(await legalResponse.json()).toMatchObject({
    terms: { accepted: true, needsAcceptance: false },
  });

  // Enroll through Settings, exercising the real frontend and server.
  await page.goto("/settings");
  await waitForApp(page);
  const setupRequest = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/auth/2fa/setup");
  await page.getByRole("button", { name: /^enable 2fa$/i }).click();
  const setupResponse = await setupRequest;
  expect(setupResponse.status()).toBe(200);
  const { secret } = await setupResponse.json();
  await expect(page.getByAltText("2FA QR Code")).toBeVisible();
  const enableMutation = observeMutation(page, "POST", "/api/v1/auth/2fa/verify");
  await page.getByLabel(/enter the 6-digit code from your app/i).fill(authenticator.generate(secret));
  const enableResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/2fa/verify" &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /verify and enable/i }).click();
  expect((await enableResponse).status()).toBe(200);
  enableMutation.assertExactlyOnce(200);
  enableMutation.stop();
  await expect(page.getByText(/2fa is currently enabled/i)).toBeVisible();
  const statusResponse = await page.context().request.get(origin + "/api/v1/auth/2fa/status");
  expect(await statusResponse.json()).toMatchObject({ enabled: true });
  await page.getByRole("button", { name: /^show$/i }).click();
  const originalBackupCodes = await page.locator("main li code").allTextContents();
  expect(originalBackupCodes.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: /^done$/i }).click();
  await page.goto("/");
  await waitForApp(page);
  // End the first session and check server-side invalidation.
  const firstLogout = observeMutation(page, "POST", "/api/v1/auth/logout");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  firstLogout.assertExactlyOnce(204);
  firstLogout.stop();
  const loggedOut = await page.context().request.get(`${origin}/api/v1/users/me`);
  expect(loggedOut.status()).toBe(401);

  // The same valid password now requires an actual second factor.
  await emailInput(page).fill(email);
  await passwordInput(page).fill(registerPayload.password);
  const secondLogin = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/login" &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  const challenge = await secondLogin;
  expect(challenge.status()).toBe(200);
  expect(await challenge.json()).toMatchObject({
    requires2FA: true,
    pendingSessionId: expect.any(String),
  });
  await page.waitForURL((url) => url.pathname === "/login/verify-2fa");
  const unauthenticated = await page.context().request.get(`${origin}/api/v1/users/me`);
  expect(unauthenticated.status()).toBe(401);

  // A wrong second factor must not create an authenticated session.
  const freshCsrf = await page.context().request.get(`${origin}/api/v1/csrf-token`);
  expect(freshCsrf.status()).toBe(200);
  const currentCode = authenticator.generate(secret);
  const wrongDigit = currentCode.endsWith("0") ? "1" : "0";
  const invalidCode = currentCode.slice(0, -1) + wrongDigit;
  const invalidVerification = await page.context().request.post(
    `${origin}/api/v1/auth/login/verify-2fa`,
    {
      data: { pendingSessionId: (await challenge.json()).pendingSessionId, code: invalidCode },
      headers: { Origin: origin, "X-CSRF-Token": (await freshCsrf.json()).csrfToken },
    },
  );
  expect(invalidVerification.status()).toBe(401);
  expect((await invalidVerification.json()).error?.code).toBe("AUTH_VERIFICATION_FAILED");
  expect(
    (await page.context().request.get(`${origin}/api/v1/users/me`)).status(),
  ).toBe(401);

  // Verify a genuine TOTP in the browser, never a synthetic/mocked login.
  const twoFactorMutation = observeMutation(page, "POST", "/api/v1/auth/login/verify-2fa");
  const verifiedResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/login/verify-2fa" &&
    response.request().method() === "POST",
  );
  await page.locator("form input[name='code']").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: /verify and continue/i }).click();
  expect((await verifiedResponse).status()).toBe(200);
  twoFactorMutation.assertExactlyOnce(200);
  twoFactorMutation.stop();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();

  const authenticated = await page.context().request.get(`${origin}/api/v1/users/me`);
  expect(authenticated.status()).toBe(200);
  expect(await authenticated.json()).toMatchObject({ primaryEmail: email });

  // Manage recovery codes and disable 2FA using real Settings controls.
  await page.goto("/settings");
  await waitForApp(page);
  await page.getByRole("button", { name: /^backup codes$/i }).click();
  await page.getByLabel(/enter your password to disable 2fa/i).fill(registerPayload.password);
  await page.getByLabel(/enter the 6-digit code from your app/i).fill(authenticator.generate(secret));
  const regeneration = observeMutation(page, "POST", "/api/v1/auth/2fa/backup-codes/regenerate");
  const regenerationResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/2fa/backup-codes/regenerate" &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^backup codes$/i }).last().click();
  expect((await regenerationResponse).status()).toBe(200);
  regeneration.assertExactlyOnce(200);
  regeneration.stop();
  await page.getByRole("button", { name: /^show$/i }).click();
  const newCodes = await page.locator("main li code").allTextContents();
  expect(newCodes.length).toBeGreaterThan(0);
  expect(newCodes).not.toEqual(originalBackupCodes);
  await page.getByRole("button", { name: /^done$/i }).click();
  await page.getByRole("button", { name: /^disable 2fa$/i }).click();
  await page.getByLabel(/enter your password to disable 2fa/i).fill(registerPayload.password);
  await page.getByLabel(/enter the 6-digit code from your app/i).fill(authenticator.generate(secret));
  const disableMutation = observeMutation(page, "POST", "/api/v1/auth/2fa/disable");
  const disableMutationResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/2fa/disable" &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /yes, disable 2fa/i }).click();
  expect((await disableMutationResponse).status()).toBe(200);
  disableMutation.assertExactlyOnce(200);
  disableMutation.stop();
  await expect(page.getByText(/2fa is currently disabled/i)).toBeVisible();
  const disabledStatus = await page.context().request.get(origin + "/api/v1/auth/2fa/status");
  expect(await disabledStatus.json()).toMatchObject({ enabled: false });
  await page.goto("/");
  await waitForApp(page);
  const finalLogout = observeMutation(page, "POST", "/api/v1/auth/logout");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  finalLogout.assertExactlyOnce(204);
  finalLogout.stop();
  const afterLogout = await page.context().request.get(`${origin}/api/v1/users/me`);
  expect(afterLogout.status()).toBe(401);
});
