const { test, expect } = require("./fixtures.cjs");
const { expectApiHttpError } = require("./browser-diagnostics.cjs");
const {
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
  dismissFirstLoginTwoFactorInvitation,
  ensureAuthenticatedBrowserConsent,
} = require("./server-helpers.cjs");

test("[E2E-SMOKE-001] login page renders the FitVibe welcome heading", async ({ page }) => {
  await preparePage(page);
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("[E2E-SMOKE-002] authenticated shell shows Home after real login", async ({ page, athleteAccount }) => {
  await preparePage(page);
  await page.goto("/login");
  await waitForApp(page);
  await emailInput(page).fill(athleteAccount.email);
  await passwordInput(page).fill(athleteAccount.password);

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

async function createDisposableAthlete(page, testInfo, options = {}) {
  await preparePage(page);
  const suffix = `${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
  const email = `smoke.${suffix}@fitvibe.test`;
  const password = "SuperSecure123!";
  const profile = {
    displayName: options.displayName ?? "Smoke Athlete",
    weight: options.weight ?? "75",
    dateOfBirth: options.dateOfBirth ?? "2000-01-15",
    gender: options.gender ?? "prefer_not_to_say",
    activityIntensity: options.activityIntensity ?? "intermediate",
  };

  await page.goto("/register");
  await waitForApp(page);
  await displayNameInput(page).fill(profile.displayName);
  await page.getByRole("spinbutton", { name: /weight/i }).fill(profile.weight);
  await page.getByLabel(/date of birth/i).fill(profile.dateOfBirth);
  await page.getByRole("combobox", { name: /^gender$/i }).selectOption(profile.gender);
  await page
    .getByRole("combobox", { name: /current activity intensity/i })
    .selectOption(profile.activityIntensity);

  if (options.withAvatar) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAk+Uzr4AAAAASUVORK5CYII=",
      "base64",
    );
    await page.getByLabel(/select photo/i).setInputFiles({
      name: "registration-avatar.png",
      mimeType: "image/png",
      buffer: png,
    });
  }

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
  // Registration may rotate the browser consent identity; resolve the real banner.
  const consentBackdrop = page.locator(".cookie-consent-backdrop");
  if (await consentBackdrop.isVisible()) {
    await consentBackdrop.getByRole("button", { name: /reject all/i }).click();
    await expect(consentBackdrop).toBeHidden();
  }
  await page.getByRole("button", { name: /go to login/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  await emailInput(page).fill(email);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  await ensureAuthenticatedBrowserConsent(page);
  expect((await apiGet(page, "/api/v1/users/me")).primaryEmail).toBe(email);
  await dismissFirstLoginTwoFactorInvitation(page);
  return { email, password, profile };
}

test("[E2E-SMOKE-003] registration persists profile fields and scanned avatar", async ({ page }, testInfo) => {
  const created = await createDisposableAthlete(page, testInfo, {
    withAvatar: true,
    displayName: "Registration Athlete",
    weight: "78.5",
    dateOfBirth: "2000-02-20",
    gender: "diverse",
    activityIntensity: "advanced",
  });

  const profile = await apiGet(page, "/api/v1/users/me");
  expect(profile.displayName).toBe(created.profile.displayName);
  expect(profile.profile?.weight).toBe(78.5);
  expect(profile.profile?.weightUnit).toBe("kg");
  expect(profile.profile?.fitnessLevel).toBe("advanced");
  expect(profile.avatar?.url).toBeTruthy();

  await page.goto("/settings");
  await waitForApp(page);
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await testInfo.attach("registration-profile-with-avatar", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

async function authenticatedPage(page, account) {
  await preparePage(page, { authenticated: true, account });
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
}

async function apiGet(page, path) {
  const response = await page.context().request.get(new URL(path, page.url()).toString());
  expect(response.status(), `GET ${path} returned ${response.status()}`).toBe(200);
  return response.json();
}

test("[E2E-SMOKE-004] athlete navigates all active surfaces with real authenticated data", async ({ page, athleteAccount }) => {
  await authenticatedPage(page, athleteAccount);
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
    if (label === "Calendar") {
      await expect(page.getByRole("grid", { name: /calendar/i })).toBeVisible();
    } else {
      await expect(page.locator(`[data-app-surface="${label.toLowerCase()}"] h1`)).toBeVisible();
    }
  }
});

test("[E2E-SMOKE-005] calendar loads real sessions, allows exercise selection and persists planned workout", async ({ page, athleteAccount }, testInfo) => {
  await authenticatedPage(page, athleteAccount);
  await page.getByRole("link", { name: /^calendar$/i }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await apiGet(page, "/api/v1/sessions?limit=20&offset=0");

  await page.getByRole("button", { name: /^plan a workout$/i }).click();
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  const exerciseSelect = editor.getByRole("combobox", { name: "Exercise", exact: true });
  await expect.poll(async () => exerciseSelect.locator("option").count()).toBeGreaterThan(1);
  const option = exerciseSelect.locator("option").nth(1);
  const selectedExerciseId = await option.getAttribute("value");
  expect(selectedExerciseId).toBeTruthy();
  await exerciseSelect.selectOption(selectedExerciseId);
  await editor.locator('button[data-component="button"]').getByText(/^Add exercise$/i).click();
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

test("[E2E-SMOKE-006] published legal documents render their actual backend content", async ({ page, athleteAccount }) => {
  await authenticatedPage(page, athleteAccount);
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

test("[E2E-SMOKE-007] athlete privacy acknowledgement withdrawal and reacceptance persist on backend", async ({ page, athleteAccount }) => {
  const waitForPrivacyResponse = (path) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === path,
    );
  await authenticatedPage(page, athleteAccount);
  const before = await apiGet(page, "/api/v1/auth/legal-documents/status");
  await page.goto("/privacy");
  await waitForApp(page);
  if (before.privacy.needsAcceptance) {
    const accept = observeMutation(page, "POST", "/api/v1/auth/privacy/accept");
    const acceptResponse = waitForPrivacyResponse("/api/v1/auth/privacy/accept");
    await page.getByRole("button", { name: /acknowledge/i }).click();
    await acceptResponse;
    await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(false);
    accept.assertExactlyOnce(200);
    accept.stop();
  }
  const revoke = observeMutation(page, "POST", "/api/v1/auth/privacy/revoke");
  const revokeResponse = waitForPrivacyResponse("/api/v1/auth/privacy/revoke");
  await page.getByRole("button", { name: /revoke acknowledgement/i }).click();
  await revokeResponse;
  await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(true);
  revoke.assertExactlyOnce(200);
  revoke.stop();
  await page.reload();
  await waitForApp(page);
  const accept = observeMutation(page, "POST", "/api/v1/auth/privacy/accept");
  const acceptResponse = waitForPrivacyResponse("/api/v1/auth/privacy/accept");
  await page.getByRole("button", { name: /acknowledge/i }).click();
  await acceptResponse;
  await expect.poll(async () => (await apiGet(page, "/api/v1/auth/legal-documents/status")).privacy.needsAcceptance).toBe(false);
  accept.assertExactlyOnce(200);
  accept.stop();
});

test("[E2E-SMOKE-008] athlete can revoke Terms and the account session is invalidated", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
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
  await expect(emailInput(page)).toBeVisible();
  const unauthenticated = await page.context().request.get(
    new URL("/api/v1/users/me", page.url()).toString(),
  );
  expect(unauthenticated.status()).toBe(401);
});

test("[E2E-SMOKE-009] athlete logout rejects subsequent authenticated profile retrieval", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await apiGet(page, "/api/v1/users/me");
  const logout = observeMutation(page, "POST", "/api/v1/auth/logout");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  logout.assertExactlyOnce(204);
  logout.stop();
  const res = await page.context().request.get(new URL("/api/v1/users/me", page.url()).toString());
  expect([401, 403]).toContain(res.status());
});

test("[E2E-SMOKE-010] athlete searches exercise library against the real catalog", async ({ page, athleteAccount }) => {
  await authenticatedPage(page, athleteAccount);
  await page.getByRole("link", { name: /^library$/i }).click();
  await page.waitForURL((url) => url.pathname === "/library");
  const catalog = await apiGet(page, "/api/v1/exercises?limit=20&offset=0");
  expect(catalog.data.length).toBeGreaterThan(0);
  const entry = catalog.data[0];
  const searchField = page.locator("[data-component='library-filter-grid'] input").first();
  await searchField.fill(entry.name);
  await expect(page.getByText(entry.name, { exact: true }).first()).toBeVisible();
});

test("[E2E-SMOKE-011] athlete starts an exercise workout and backend records an in-progress session", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.getByRole("link", { name: /^calendar$/i }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: /^start/i }).first().click();
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  const select = editor.getByRole("combobox").first();
  await expect.poll(async () => select.locator("option").count()).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  await editor.locator('button[data-component="button"]').getByText(/^Add exercise$/i).click();
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


test("[E2E-SMOKE-012] athlete creates personal exercise and finds it after reload", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/library");
  await waitForApp(page);
  await page.getByRole("button", { name: /new exercise/i }).click();
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

test("[E2E-SMOKE-013] athlete saves complete editable profile across navigation", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/settings");
  await waitForApp(page);

  const name = `Smoke Profile ${Date.now()}`;
  const alias = `smoke-profile-${Date.now()}`;
  const weight = "82.5";
  const fitnessLevel = "advanced";
  const trainingFrequency = "5_plus_per_week";

  await page.getByRole("textbox", { name: /display name/i }).fill(name);
  await page.getByRole("textbox", { name: /^alias$/i }).fill(alias);
  await page.getByRole("spinbutton", { name: /^weight$/i }).fill(weight);
  await page.getByRole("combobox", { name: /fitness level/i }).selectOption(fitnessLevel);
  await page
    .getByRole("combobox", { name: /training frequency/i })
    .selectOption(trainingFrequency);

  const profilePatch = observeMutation(page, "PATCH", "/api/v1/users/me");
  await page.getByRole("button", { name: /^save$/i }).first().click();

  await expect
    .poll(async () => {
      const profile = await apiGet(page, "/api/v1/users/me");
      return {
        displayName: profile.displayName,
        alias: profile.profile?.alias,
        weight: profile.profile?.weight,
        weightUnit: profile.profile?.weightUnit,
        fitnessLevel: profile.profile?.fitnessLevel,
        trainingFrequency: profile.profile?.trainingFrequency,
      };
    })
    .toEqual({
      displayName: name,
      alias,
      weight: 82.5,
      weightUnit: "kg",
      fitnessLevel,
      trainingFrequency,
    });

  profilePatch.assertExactlyOnce(200);
  profilePatch.stop();

  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole("textbox", { name: /display name/i })).toHaveValue(name);
  await expect(page.getByRole("textbox", { name: /^alias$/i })).toHaveValue(alias);
  await expect(page.getByRole("spinbutton", { name: /^weight$/i })).toHaveValue(weight);
  await expect(page.getByRole("combobox", { name: /fitness level/i })).toHaveValue(fitnessLevel);
  await expect(page.getByRole("combobox", { name: /training frequency/i })).toHaveValue(
    trainingFrequency,
  );

  await testInfo.attach("profile-settings-saved", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("[E2E-SMOKE-014] Settings rejects invalid profile edits and preserves persisted data", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/settings");
  await waitForApp(page);

  const before = await apiGet(page, "/api/v1/users/me");
  const alias = page.getByRole("textbox", { name: /^alias$/i });
  await alias.fill("invalid alias with spaces!");

  expectApiHttpError(page, "PATCH", "/api/v1/users/me", 422);
  const mutation = observeMutation(page, "PATCH", "/api/v1/users/me");
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await expect(page.getByRole("status")).toContainText(/could not|failed|error|unable/i);
  mutation.assertExactlyOnce(422);
  mutation.stop();

  const after = await apiGet(page, "/api/v1/users/me");
  expect(after.profile?.alias).toBe(before.profile?.alias);
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole("textbox", { name: /^alias$/i })).toHaveValue(before.profile?.alias ?? "");
});

test("[E2E-SMOKE-015] athlete uploads and removes avatar from Settings", async ({ page }, testInfo) => {
  await createDisposableAthlete(page, testInfo);
  await page.goto("/settings");
  await waitForApp(page);

  const placeholder = page.getByTestId("avatar-placeholder");
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toHaveAttribute("data-size", "lg");
  await expect(placeholder).toHaveAttribute("role", "img");
  await expect(placeholder).toHaveAttribute("aria-label", /smoke athlete/i);
  await testInfo.attach("avatar-placeholder", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAk+Uzr4AAAAASUVORK5CYII=",
    "base64",
  );
  const fileInput = page.getByLabel(/select image/i);
  await fileInput.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: png,
  });

  const upload = observeMutation(page, "POST", "/api/v1/users/me/avatar");
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/users/me/avatar",
  );
  await page.getByRole("button", { name: /^upload$/i }).click();
  expect((await uploadResponse).status()).toBe(201);
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await expect.poll(async () => (await apiGet(page, "/api/v1/users/me")).avatar?.url).toBeTruthy();
  upload.assertExactlyOnce(201);
  upload.stop();

  await page.reload();
  await waitForApp(page);
  const persistedPreview = page.getByTestId("avatar-preview");
  await expect(persistedPreview).toBeVisible();
  const avatarImage = persistedPreview.getByRole("img", { name: /smoke athlete/i });
  await expect(avatarImage).toBeVisible();
  await expect.poll(async () =>
    avatarImage.evaluate((img) => ({
      complete: img.complete,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })),
  ).toEqual({ complete: true, width: 128, height: 128 });

  const remove = observeMutation(page, "DELETE", "/api/v1/users/me/avatar");
  const removeResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === "/api/v1/users/me/avatar",
  );
  await page.getByRole("button", { name: /^delete$/i }).click();
  expect((await removeResponse).status()).toBe(204);
  await expect(page.getByTestId("avatar-placeholder")).toBeVisible();
  await expect.poll(async () => (await apiGet(page, "/api/v1/users/me")).avatar).toBeNull();
  remove.assertExactlyOnce(204);
  remove.stop();
});

test("[E2E-SMOKE-016] athlete changes Vibeform and Dashboard reflects saved profile", async ({ fullyOnboardedPage }) => {
  // Exercise Vibeform persistence using the real, already authenticated and
  // consented worker account. A fresh first-login session and consent reload
  // are not part of this scenario and exhaust the shared CI rate limit.
  const page = fullyOnboardedPage;
  await page.goto("/settings");
  await waitForApp(page);
  // Explicitly catch onboarding regressions instead of bypassing the overlay.
  await expect(page.locator(".cookie-consent-backdrop")).toBeHidden();
  const before = await apiGet(page, "/api/v1/users/me");
  expect(before.id).toBeTruthy();
  const bodyProfile = page.getByRole("combobox", { name: /body profile/i });
  await expect(bodyProfile).toBeVisible();
  const original = await bodyProfile.inputValue();
  const changed = original === "balanced" ? "hip-dominant" : "balanced";
  await bodyProfile.selectOption(changed);
  const save = page.locator(".training-panel")
    .filter({ has: page.getByText("Vibeform", { exact: true }) })
    .getByRole("button", { name: /^save$/i });
  const mutation = observeMutation(page, "PUT", "/api/v1/vibeforms/me/preferences");
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/vibeforms/me/preferences" &&
      response.request().method() === "PUT",
  );
  await save.click();
  expect((await responsePromise).status()).toBe(200);
  mutation.assertExactlyOnce(200);
  mutation.stop();
  // In-app navigation preserves the session without reloading the entire
  // application and rechecking consent on every route change.
  await page.getByRole("link", { name: /^dashboard$/i }).click();
  await expect(page.locator("[data-app-surface='dashboard']")).toBeVisible();
  await page.getByRole("link", { name: /^settings$/i }).click();
  await expect(page.getByRole("combobox", { name: /body profile/i })).toHaveValue(changed);
});

test("[E2E-SMOKE-017] Home and Dashboard retrieve real feed, completed activity, badges and Vibeform", async ({ page, athleteAccount }) => {
  await authenticatedPage(page, athleteAccount);
  await apiGet(page, "/api/v1/sessions?status=completed&limit=10");
  await apiGet(page, "/api/v1/feed?scope=public&limit=10&sort=date");
  await page.getByRole("link", { name: /^dashboard$/i }).click();
  await expect(page.locator("[data-app-surface='dashboard']")).toBeVisible();
  await expect(page.locator("[data-app-surface='dashboard'] button[aria-pressed]")).toHaveCount(6);
});

test("[E2E-SMOKE-018] athlete uses Library exercise to open workout planning across surfaces", async ({ page }, testInfo) => {
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
  const created = sessions.data.find((session) => session.title === title);
  expect(created?.id).toBeTruthy();
  const detail = await apiGet(page, `/api/v1/sessions/${created.id}`);
  expect(detail.exercises.some((item) => item.exercise_id === exercise.id)).toBe(true);
});
