const { test, expect } = require("./fixtures.cjs");
const {
  TEST_USER,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
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

async function createDisposableAthlete(page, testInfo) {
  await preparePage(page);
  const suffix = `${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
  const email = `smoke.${suffix}@fitvibe.test`;
  const password = "SuperSecure123!";
  await page.goto("/register");
  await waitForApp(page);
  await displayNameInput(page).fill("Smoke Athlete");
  await emailInput(page).fill(email);
  await page.locator("form input[name='username']").fill(`smoke.${suffix}`);
  await passwordInput(page).fill(password);
  await confirmPasswordInput(page).fill(password);
  await acceptRegisterLegal(page);
  const registration = page.waitForResponse((res) =>
    new URL(res.url()).pathname === "/api/v1/auth/register" && res.request().method() === "POST");
  await page.getByRole("button", { name: /create account/i }).click();
  const response = await registration;
  expect(response.status()).toBe(202);
  const payload = await response.json();
  expect(payload.debugVerificationToken).toBeTruthy();
  await page.goto(`/verify?token=${encodeURIComponent(payload.debugVerificationToken)}`);
  await waitForApp(page);
  await page.getByRole("button", { name: /go to login/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  await emailInput(page).fill(email);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  expect((await apiGet(page, "/api/v1/users/me")).primaryEmail).toBe(email);
}

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
  await editor.getByRole("button", { name: /^add exercise$/i }).click();
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

test("athlete can revoke Terms and the account session is invalidated", async ({ page }) => {
  await authenticatedPage(page);
  const before = await apiGet(page, "/api/v1/auth/legal-documents/status");
  expect(before.terms.needsAcceptance).toBe(false);
  await page.goto("/terms");
  await waitForApp(page);
  const revoke = observeMutation(page, "POST", "/api/v1/auth/terms/revoke");
  await page.getByRole("button", { name: /^revoke consent$/i }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /revoke|confirm/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  revoke.assertExactlyOnce(200);
  revoke.stop();
  await page.goto("/");
  await waitForApp(page);
  await expect(page).toHaveURL(/\/login$/);
});

test("athlete logout rejects subsequent authenticated profile retrieval", async ({ page }) => {
  await authenticatedPage(page);
  await apiGet(page, "/api/v1/users/me");
  const logout = observeMutation(page, "POST", "/api/v1/auth/logout");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  logout.assertExactlyOnce(200);
  logout.stop();
  const res = await page.context().request.get(new URL("/api/v1/users/me", page.url()).toString());
  expect([401, 403]).toContain(res.status());
});

test("athlete searches exercise library against the real catalog", async ({ page }) => {
  await authenticatedPage(page);
  await page.getByRole("link", { name: /^library$/i }).click();
  await page.waitForURL((url) => url.pathname === "/library");
  const catalog = await apiGet(page, "/api/v1/exercises?limit=20&offset=0");
  expect(catalog.data.length).toBeGreaterThan(0);
  const entry = catalog.data[0];
  const searchField = page.locator("[data-component='library-filter-grid'] input").first();
  await searchField.fill(entry.name);
  await expect(page.getByText(entry.name, { exact: true }).first()).toBeVisible();
});

test("athlete starts an exercise workout and backend records an in-progress session", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.getByRole("link", { name: /^calendar$/i }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: /^start/i }).first().click();
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  const select = editor.getByRole("combobox").first();
  await expect.poll(async () => select.locator("option").count()).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  await editor.getByRole("button", { name: /^add exercise$/i }).click();
  const title = `E2E smoke started ${Date.now()}`;
  await editor.getByRole("textbox").first().fill(title);
  const create = observeMutation(page, "POST", "/api/v1/sessions");
  await editor.getByRole("button", { name: /^start/i }).last().click();
  await expect(editor).not.toBeVisible();
  create.assertExactlyOnce(201);
  create.stop();
  const sessions = await apiGet(page, "/api/v1/sessions?limit=100&offset=0");
  expect(sessions.data.some((session) => session.title === title && session.status === "in_progress")).toBe(true);
});


test("athlete creates personal exercise and finds it after reload", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/library");
  await waitForApp(page);
  await page.getByRole("button", { name: /create exercise/i }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const form = modal.locator("#exercise-creator-form");
  const name = `Smoke movement ${Date.now()}`;
  await form.getByRole("textbox").first().fill(name);
  const typeSelect = form.getByRole("combobox").first();
  await expect.poll(async () => typeSelect.locator("option").count()).toBeGreaterThan(1);
  await typeSelect.selectOption({ index: 1 });
  const create = observeMutation(page, "POST", "/api/v1/exercises");
  await modal.getByRole("button", { name: /^save$/i }).click();
  await expect(modal).not.toBeVisible();
  create.assertExactlyOnce(201);
  create.stop();
  await page.reload();
  await waitForApp(page);
  await page.locator("[data-component='library-filter-grid'] input").first().fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test("athlete saves profile and preference changes across navigation", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/settings");
  await waitForApp(page);
  const name = `Smoke Profile ${Date.now()}`;
  await page.getByRole("textbox", { name: /display name/i }).fill(name);
  const profilePatch = observeMutation(page, "PATCH", "/api/v1/users/me");
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await expect.poll(async () => (await apiGet(page, "/api/v1/users/me")).displayName).toBe(name);
  profilePatch.assertExactlyOnce(200);
  profilePatch.stop();
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole("textbox", { name: /display name/i })).toHaveValue(name);
});

test("athlete changes Vibeform and Dashboard reflects saved profile", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/settings");
  await waitForApp(page);
  const before = await apiGet(page, "/api/v1/users/me");
  expect(before.id).toBeTruthy();
  const bodyProfile = page.getByRole("combobox", { name: /body profile/i });
  await expect(bodyProfile).toBeVisible();
  const original = await bodyProfile.inputValue();
  const changed = original === "balanced" ? "hip-dominant" : "balanced";
  await bodyProfile.selectOption(changed);
  const save = page.getByRole("button", { name: /^save$/i }).nth(2);
  await save.click();
  await page.goto("/dashboard");
  await waitForApp(page);
  await expect(page.locator("[data-app-surface='dashboard']")).toBeVisible();
  await page.goto("/settings");
  await waitForApp(page);
  await expect(page.getByRole("combobox", { name: /body profile/i })).toHaveValue(changed);
});

test("Home and Dashboard retrieve real feed, completed activity, badges and Vibeform", async ({ page }) => {
  await authenticatedPage(page);
  await apiGet(page, "/api/v1/sessions?status=completed&limit=10");
  await apiGet(page, "/api/v1/feed?scope=public&limit=10&sort=date");
  await page.getByRole("link", { name: /^dashboard$/i }).click();
  await expect(page.locator("[data-app-surface='dashboard']")).toBeVisible();
  await expect(page.locator("[data-app-surface='dashboard'] button[aria-pressed]")).toHaveCount(6);
});

test("athlete uses Library exercise to open workout planning across surfaces", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/library");
  await waitForApp(page);
  const exercises = await apiGet(page, "/api/v1/exercises?limit=20&offset=0");
  expect(exercises.data.length).toBeGreaterThan(0);
  const exercise = exercises.data[0];
  await page.locator("[data-component='library-filter-grid'] input").first().fill(exercise.name);
  const grid = page.locator("[data-component='library-result-grid']");
  await expect(grid.getByText(exercise.name, { exact: true }).first()).toBeVisible();
  await grid.getByRole("button", { name: /add to workout/i }).first().click();
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  const title = `Library linked workout ${Date.now()}`;
  await editor.getByRole("textbox").first().fill(title);
  const create = observeMutation(page, "POST", "/api/v1/sessions");
  await editor.getByRole("button", { name: /plan/i }).last().click();
  await expect(editor).not.toBeVisible();
  create.assertExactlyOnce(201);
  create.stop();
  const sessions = await apiGet(page, "/api/v1/sessions?limit=100&offset=0");
  expect(sessions.data.some((session) => session.title === title &&
    session.exercises.some((item) => item.exercise_id === exercise.id))).toBe(true);
});
