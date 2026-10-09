const { test, expect } = require("./fixtures.cjs");
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


const { observeMutation } = require("./request-observer.cjs");

async function authenticatedPage(page) {
  await preparePage(page, { authenticated: true });
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
}

async function apiGet(page, path) {
  const response = await page.context().request.get(new URL(path, page.url()).toString());
  expect(response.status(), `GET ${path} returned ${response.status()}`).toBe(200);
  return response.json();
}

test("athlete navigates all active surfaces with real authenticated data", async ({ page }) => {
  await authenticatedPage(page);
  expect((await apiGet(page, "/api/v1/users/me")).id).toBeTruthy();
  for (const [label, route] of [
    ["Calendar", "/calendar"],
    ["Library", "/library"],
    ["Dashboard", "/dashboard"],
    ["Settings", "/settings"],
    ["Home", "/"],
  ]) {
    await page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).click();
    await page.waitForURL((url) => url.pathname === route);
    await expect(page.getByRole("heading", { name: new RegExp(`^${label}$`, "i"), level: 1 })).toBeVisible();
  }
});

test("calendar loads real sessions, allows exercise selection and persists planned workout", async ({ page }, testInfo) => {
  await authenticatedPage(page);
  await page.getByRole("link", { name: /^calendar$/i }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await apiGet(page, "/api/v1/sessions?limit=20&offset=0");

  await page.getByRole("button", { name: /plan/i }).first().click();
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  const exerciseSelect = editor.getByRole("combobox").first();
  await expect.poll(async () => exerciseSelect.locator("option").count()).toBeGreaterThan(1);
  const option = exerciseSelect.locator("option").nth(1);
  const selectedExerciseId = await option.getAttribute("value");
  expect(selectedExerciseId).toBeTruthy();
  await exerciseSelect.selectOption(selectedExerciseId);
  await editor.getByRole("button", { name: /add exercise/i }).click();
  const title = `E2E smoke plan ${testInfo.workerIndex}-${Date.now()}`;
  await editor.getByRole("textbox").first().fill(title);
  const mutation = observeMutation(page, "POST", "/api/v1/sessions");
  await editor.getByRole("button", { name: /plan/i }).last().click();
  await expect(editor).not.toBeVisible();
  mutation.assertExactlyOnce(201);
  mutation.stop();
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText(title).first()).toBeVisible();
});

test("published legal documents render their actual backend content", async ({ page }) => {
  await authenticatedPage(page);
  for (const kind of ["terms", "privacy"]) {
    const published = await apiGet(page, `/api/v1/legal/documents/${kind}?language=en`);
    expect(published.documentType).toBe(kind);
    expect(published.version).toBeTruthy();
    await page.goto(`/${kind}`);
    await waitForApp(page);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText(/pre-publication legacy version is displayed/i)).toHaveCount(0);
  }
  const status = await apiGet(page, "/api/v1/auth/legal-documents/status");
  expect(status.terms.currentVersion).toBeTruthy();
  expect(status.privacy.currentVersion).toBeTruthy();
});

test("athlete privacy acknowledgement withdrawal and reacceptance persist on backend", async ({ page }) => {
  await authenticatedPage(page);
  const before = await apiGet(page, "/api/v1/auth/legal-documents/status");
  await page.goto("/privacy");
  await waitForApp(page);
  if (before.privacy.needsAcceptance) {
    const accept = observeMutation(page, "POST", "/api/v1/auth/privacy/accept");
    await page.getByRole("button", { name: /acknowledge/i }).click();
    await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(false);
    accept.assertExactlyOnce(200);
    accept.stop();
  }
  const revoke = observeMutation(page, "POST", "/api/v1/auth/privacy/revoke");
  await page.getByRole("button", { name: /revoke acknowledgement/i }).click();
  await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(true);
  revoke.assertExactlyOnce(200);
  revoke.stop();
  await page.reload();
  await waitForApp(page);
  const accept = observeMutation(page, "POST", "/api/v1/auth/privacy/accept");
  await page.getByRole("button", { name: /acknowledge/i }).click();
  await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(false);
  accept.assertExactlyOnce(200);
  accept.stop();
});
