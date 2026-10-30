const crypto = require("node:crypto");
const AUTH_FLAG_KEY = "fitvibe:auth";
const AUTH_HINT_INITIALIZED_KEY = "fitvibe:e2e:auth-hint-initialized";
const APPLICATION_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const APPLICATION_ORIGIN = new URL(APPLICATION_BASE_URL).origin;

const TEST_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@fitvibe.local",
  password: process.env.ADMIN_PASSWORD || "admin",
  username: "admin",
  role: "admin",
};

async function installBrowserState(page, { authenticated = false } = {}) {
  // Test ownership: #557. An init script survives navigation. Seed the UI
  // hint once per tab, never overwrite a subsequent real login or logout.
  // HttpOnly session cookies are established/validated independently below.
  await page.addInitScript(
    ({ storageKey, initializedKey, authenticated }) => {
      if (window.sessionStorage.getItem(initializedKey) === "1") return;
      if (authenticated) {
        window.sessionStorage.setItem(storageKey, "1");
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
      window.sessionStorage.setItem(initializedKey, "1");
    },
    {
      storageKey: AUTH_FLAG_KEY,
      initializedKey: AUTH_HINT_INITIALIZED_KEY,
      authenticated,
    },
  );
}

async function getCsrfToken(request, label) {
  const response = await request.get(`${APPLICATION_ORIGIN}/api/v1/csrf-token`);
  if (!response.ok()) {
    throw new Error(`Unable to acquire ${label} CSRF token: HTTP ${response.status()}`);
  }
  const { csrfToken } = await response.json();
  if (!csrfToken) {
    throw new Error(`Unable to acquire ${label} CSRF token: response omitted csrfToken`);
  }
  return csrfToken;
}

async function createSeededSession(page, account = TEST_USER) {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(request, "E2E session");

  const loginResponse = await retryRateLimitedMutation(() => request.post(`${APPLICATION_ORIGIN}/api/v1/auth/login`, {
    data: { email: account.email, password: account.password },
    headers: {
      Origin: APPLICATION_ORIGIN,
      "X-CSRF-Token": csrfToken,
    },
  }), "E2E login");
  if (!loginResponse.ok()) {
    throw new Error(`Unable to create seeded E2E session: HTTP ${loginResponse.status()}`);
  }

  const loginBody = await loginResponse.json();
  if (loginBody.requires2FA !== false) {
    throw new Error("Seeded E2E user unexpectedly requires 2FA");
  }

  const sessionCheck = await request.get(`${APPLICATION_ORIGIN}/api/v1/users/me`);
  if (!sessionCheck.ok()) {
    throw new Error(`Seeded E2E session did not persist: HTTP ${sessionCheck.status()}`);
  }
  const user = await sessionCheck.json();
  if (user.primaryEmail !== account.email && (!account.id || user.id !== account.id)) {
    throw new Error("E2E session resolved to an unexpected account");
  }
}

async function ensureSeededSession(page, account = TEST_USER) {
  // Test ownership: #557. Ordinary read-only tests restore a real, verified
  // session established by their Playwright worker, without repeatedly
  // consuming the auth_login per-IP quota. Cookie jars remain test-scoped.
  if (!account.sessionCookies) {
    await createSeededSession(page, account);
    return;
  }
  await page.context().addCookies(account.sessionCookies);
  const response = await page.context().request.get(`${APPLICATION_ORIGIN}/api/v1/users/me`);
  if (!response.ok()) {
    throw new Error(`E2E cached athlete session is inactive: HTTP ${response.status()}`);
  }
  const user = await response.json();
  if (user.primaryEmail !== account.email || account.role !== "athlete") {
    throw new Error("E2E cached session does not belong to the expected athlete");
  }
}

// Only consent status is retried: it is an idempotent read shared by many real
// browser journeys on the CI runner's loopback IP. Respect the server's
// Retry-After rather than bypassing its abuse control or mocking consent.
async function retryRateLimitedMutation(operation, label) {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const response = await operation();
    if (response.status() !== 429) {
      return response;
    }
    const retryAfter = Number(response.headers()["retry-after"]);
    if (!Number.isFinite(retryAfter) || retryAfter < 0) {
      throw new Error(`${label} rate-limited without valid Retry-After`);
    }
    const delay = Math.max(1000, Math.ceil(retryAfter * 1000));
    if (Date.now() + delay > deadline) {
      throw new Error(`${label} remained rate-limited beyond recovery deadline`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function getConsentStatusWithRateLimitBackoff(request, url) {
  const deadline = Date.now() + 75_000;
  for (;;) {
    const response = await request.get(url);
    if (response.status() !== 429) return response;

    const retryAfter = Number(response.headers()["retry-after"]);
    if (!Number.isFinite(retryAfter) || retryAfter < 0) {
      throw new Error("Consent status was rate-limited without a valid Retry-After");
    }
    const delay = Math.max(1000, Math.ceil(retryAfter * 1000));
    if (Date.now() + delay > deadline) {
      throw new Error("Consent status remained rate-limited beyond the E2E recovery deadline");
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function ensureEssentialCookieConsent(page) {
  const request = page.context().request;
  const statusUrl = `${APPLICATION_ORIGIN}/api/v1/consent/cookie-status`;
  const previous = await getConsentStatusWithRateLimitBackoff(request, statusUrl);
  if (!previous.ok()) {
    throw new Error(`Unable to retrieve E2E consent status: HTTP ${previous.status()}`);
  }
  const previousBody = await previous.json();
  if (!previousBody.data?.hasConsent) {
    const csrfToken = await getCsrfToken(request, "E2E consent");
    const response = await retryRateLimitedMutation(() => request.post(
      `${APPLICATION_ORIGIN}/api/v1/consent/cookie-preferences`,
      {
        data: {
          essential: true,
          preferences: false,
          analytics: false,
          marketing: false,
          source: "banner",
        },
        headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
      },
    ), "E2E consent persistence");
    if (!response.ok()) {
      throw new Error(`Unable to persist E2E consent: HTTP ${response.status()}`);
    }
  }

  const saved = await getConsentStatusWithRateLimitBackoff(request, statusUrl);
  if (!saved.ok()) {
    throw new Error(`Unable to verify E2E consent: HTTP ${saved.status()}`);
  }
  const result = (await saved.json()).data;
  if (
    !result?.hasConsent ||
    result.consent?.essential !== true ||
    result.consent?.preferences !== false ||
    result.consent?.analytics !== false ||
    result.consent?.marketing !== false
  ) {
    throw new Error("E2E browser consent was not persisted as essential-only");
  }

  const consentCookies = (await page.context().cookies(statusUrl)).filter(
    (cookie) => cookie.name === "fitvibe_consent_client",
  );
  if (consentCookies.length !== 1) {
    throw new Error("E2E consent API did not issue exactly one browser identity cookie");
  }
}

// Shared checkpoint for ordinary authenticated E2E journeys. A registration or
// login can rotate the consent browser identity after initial preparation.
// Persist essential-only consent through the real API, then reload so the
// rendered application observes that exact persisted browser identity.
// Consent-specific tests intentionally do not call this helper.
async function ensureAuthenticatedBrowserConsent(page) {
  const { expect } = require("@playwright/test");
  await ensureEssentialCookieConsent(page);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator(".cookie-consent-backdrop")).toBeHidden();
}

// Resolve the real first-login invitation when a test exercises a different
// journey. Never bypass the modal using forced clicks or synthetic status.
const SUPPORTED_LOCALES = ["en", "de", "es", "fr", "el"];

function normalizeLocale(locale) {
  const normalized = String(locale || "en").slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : "en";
}

function localeMessages(locale) {
  const normalized = normalizeLocale(locale);
  return {
    common: require(`../../../apps/frontend/src/i18n/locales/${normalized}/common.json`),
    cookie: require(`../../../apps/frontend/src/i18n/locales/${normalized}/cookie.json`),
  };
}

async function currentLocale(page) {
  return normalizeLocale(await page.locator("html").getAttribute("lang"));
}

async function getFirstLoginTwoFactorDialog(page) {
  const { common } = localeMessages(await currentLocale(page));
  return page.getByRole("dialog", { name: common.firstLogin2fa.title });
}

async function getCookieConsentDialog(page) {
  const { cookie } = localeMessages(await currentLocale(page));
  return page.getByRole("dialog", { name: cookie.title });
}

// Resolve the real first-login invitation when a test exercises a different
// journey. Never bypass the modal using forced clicks or synthetic status.
async function dismissFirstLoginTwoFactorInvitation(page) {
  const { expect } = require("@playwright/test");
  const { common } = localeMessages(await currentLocale(page));
  const dialog = page.getByRole("dialog", { name: common.firstLogin2fa.title });
  await expect(dialog).toBeVisible();
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/auth/2fa/invitation/dismiss" &&
    response.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: common.firstLogin2fa.notNow, exact: true })
    .click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(dialog).toHaveCount(0);
  const status = await page.context().request.get(
    new URL("/api/v1/auth/2fa/status", page.url()).toString(),
  );
  expect(status.ok()).toBeTruthy();
  expect(await status.json()).toMatchObject({ invitationDismissed: true });
}

// Test ownership: #557, shared E2E onboarding fixture. Verify persistent
// server state rather than hiding the first-login dialog or forcing clicks.
async function ensureSeededOnboardingComplete(page) {
  const request = page.context().request;
  const statusUrl = `${APPLICATION_ORIGIN}/api/v1/auth/2fa/status`;
  let response = await request.get(statusUrl);
  if (!response.ok()) {
    throw new Error(`E2E 2FA status failed: HTTP ${response.status()}`);
  }
  const status = await response.json();
  if (status.enabled || status.invitationDismissed) return;

  const csrf = await request.get(`${APPLICATION_ORIGIN}/api/v1/csrf-token`);
  if (!csrf.ok()) throw new Error(`E2E onboarding CSRF failed: HTTP ${csrf.status()}`);
  const { csrfToken } = await csrf.json();
  response = await request.post(`${APPLICATION_ORIGIN}/api/v1/auth/2fa/invitation/dismiss`, {
    headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
  });
  if (!response.ok()) throw new Error(`E2E 2FA dismissal failed: HTTP ${response.status()}`);
  const verified = await request.get(statusUrl);
  if (!verified.ok() || !(await verified.json()).invitationDismissed) {
    throw new Error("E2E 2FA invitation dismissal was not persisted");
  }
}

function fixtureAccountId(testInfo) {
  const runIdentity = process.env.GITHUB_RUN_ID || process.env.CI_NODE_INDEX || String(process.pid);
  return crypto
    .createHash("sha256")
    .update(`${runIdentity}:${testInfo.testId}:${testInfo.retry}:${testInfo.repeatEachIndex}`)
    .digest("hex")
    .slice(0, 16);
}

async function assertConsentRequired(page) {
  const response = await getConsentStatusWithRateLimitBackoff(
    page.context().request,
    `${APPLICATION_ORIGIN}/api/v1/consent/cookie-status`,
  );
  if (!response.ok()) {
    throw new Error(`Unable to verify consent-required state: HTTP ${response.status()}`);
  }
  const result = (await response.json()).data;
  if (result?.hasConsent) {
    throw new Error("Expected a consent-required browser state, but consent is already persisted");
  }
}

async function setAccountLanguage(page, locale) {
  const language = normalizeLocale(locale);
  const request = page.context().request;
  const csrfToken = await getCsrfToken(request, "account language");
  const response = await request.patch(`${APPLICATION_ORIGIN}/api/v1/users/me/preferences`, {
    data: { language },
    headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": csrfToken },
  });
  if (!response.ok()) {
    throw new Error(`Unable to persist account language: HTTP ${response.status()}`);
  }
  const persisted = await request.get(`${APPLICATION_ORIGIN}/api/v1/users/me/preferences`);
  if (!persisted.ok() || (await persisted.json()).language !== language) {
    throw new Error("Account language did not persist");
  }
  return language;
}

async function createFirstLoginAccount(page, testInfo) {
  const id = fixtureAccountId(testInfo);
  const account = {
    email: `onboarding.${id}@fitvibe.test`,
    username: `onboarding-${id}`,
    password: "FixtureSecure123!",
    role: "athlete",
  };
  const request = page.context().request;
  const registerCsrf = await getCsrfToken(request, "first-login registration");
  const registration = await retryRateLimitedMutation(() => request.post(`${APPLICATION_ORIGIN}/api/v1/auth/register`, {
    data: {
      email: account.email,
      username: account.username,
      password: account.password,
      terms_accepted: true,
    },
    headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": registerCsrf },
  }), "E2E registration");
  if (registration.status() !== 202) {
    throw new Error(`Unable to create first-login fixture account: HTTP ${registration.status()}`);
  }
  const registrationBody = await registration.json();
  if (!registrationBody.debugVerificationToken) {
    throw new Error("First-login fixture registration omitted debugVerificationToken");
  }

  const verification = await request.get(
    `${APPLICATION_ORIGIN}/api/v1/auth/verify?token=${encodeURIComponent(
      registrationBody.debugVerificationToken,
    )}`,
  );
  if (!verification.ok()) {
    throw new Error(`Unable to verify first-login fixture account: HTTP ${verification.status()}`);
  }

  const loginCsrf = await getCsrfToken(request, "first-login session");
  const login = await retryRateLimitedMutation(() => request.post(`${APPLICATION_ORIGIN}/api/v1/auth/login`, {
    data: { email: account.email, password: account.password },
    headers: { Origin: APPLICATION_ORIGIN, "X-CSRF-Token": loginCsrf },
  }), "E2E first-login session");
  if (!login.ok()) {
    throw new Error(`Unable to login first-login fixture account: HTTP ${login.status()}`);
  }
  const loginBody = await login.json();
  if (loginBody.requires2FA !== false) {
    throw new Error("Fresh first-login fixture unexpectedly requires 2FA");
  }

  await installBrowserState(page, { authenticated: true });

  const me = await request.get(`${APPLICATION_ORIGIN}/api/v1/users/me`);
  if (!me.ok() || (await me.json()).primaryEmail !== account.email) {
    throw new Error("First-login fixture authenticated session did not persist");
  }
  const status = await request.get(`${APPLICATION_ORIGIN}/api/v1/auth/2fa/status`);
  if (!status.ok()) {
    throw new Error(`Unable to verify first-login 2FA state: HTTP ${status.status()}`);
  }
  const statusBody = await status.json();
  if (statusBody.enabled || statusBody.invitationDismissed) {
    throw new Error("Fresh first-login fixture is not in the expected pending invitation state");
  }

  return account;
}

async function prepareFullyOnboardedPage(page, account) {
  if (!account || account.role !== "athlete") {
    throw new Error("Fully onboarded E2E fixture requires a registered athlete account");
  }
  await preparePage(page, { authenticated: true, consent: true, account });
  return account;
}

async function prepareConsentRequiredPage(page, account) {
  if (!account || account.role !== "athlete") {
    throw new Error("Consent-required E2E fixture requires a registered athlete account");
  }
  await page.context().clearCookies();
  await installBrowserState(page, { authenticated: true });
  await assertConsentRequired(page);
  // A consent-required fixture needs a fresh browser identity. Never restore
  // the worker's consent cookie together with its authenticated session.
  await ensureSeededSession(page, {
    email: account.email,
    password: account.password,
    role: account.role,
  });
  await ensureSeededOnboardingComplete(page);
}

async function prepareFirstLoginState(page, testInfo) {
  await page.context().clearCookies();
  await assertConsentRequired(page);
  const account = await createFirstLoginAccount(page, testInfo);
  return account;
}

async function preparePage(
  page,
  { authenticated = false, consent = true, account = TEST_USER } = {},
) {
  await installBrowserState(page, { authenticated });
  if (consent) {
    await ensureEssentialCookieConsent(page);
  }
  if (authenticated) {
    await ensureSeededSession(page, account);
    await ensureSeededOnboardingComplete(page);
  }
}

function trackRequests(page, predicate) {
  const requests = [];
  const handler = (request) => {
    if (predicate(request)) requests.push(request);
  };
  page.on("request", handler);
  return { requests, stop: () => page.off("request", handler) };
}

async function waitForApp(page) {
  await page.locator("#login-shell").waitFor({ state: "detached", timeout: 15_000 });
}

const emailInput = (page) => page.locator("form input[name='email']");
const passwordInput = (page) => page.locator("form input[name='password']");
const confirmPasswordInput = (page) => page.locator("form input[name='confirmPassword']");
const displayNameInput = (page) => page.locator("form input[name='name']");

async function acceptRegisterLegal(page) {
  const controls = page.locator("form [data-component='checkbox']");
  const checkboxes = page.getByRole("checkbox");

  for (let index = 0; index < 2; index += 1) {
    const visibleBox = controls.nth(index).locator("[data-slot='checkbox-box']");
    await visibleBox.scrollIntoViewIfNeeded();

    const bounds = await visibleBox.boundingBox();
    if (!bounds) {
      throw new Error(
        `Registration legal checkbox ${index + 1} visible hit target has no bounding box.`,
      );
    }

    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    if (!(await checkboxes.nth(index).isChecked())) {
      throw new Error(
        `Registration legal checkbox ${index + 1} did not toggle through its visible checkbox hit target.`,
      );
    }
  }
}

module.exports = {
  AUTH_FLAG_KEY,
  TEST_USER,
  preparePage,
  ensureEssentialCookieConsent,
  ensureAuthenticatedBrowserConsent,
  ensureSeededOnboardingComplete,
  getConsentStatusWithRateLimitBackoff,
  trackRequests,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
  dismissFirstLoginTwoFactorInvitation,
  getFirstLoginTwoFactorDialog,
  getCookieConsentDialog,
  localeMessages,
  currentLocale,
  setAccountLanguage,
  assertConsentRequired,
  createFirstLoginAccount,
  prepareFullyOnboardedPage,
  prepareConsentRequiredPage,
  prepareFirstLoginState,
};
