const AUTH_FLAG_KEY = "fitvibe:auth";
const CONSENT_KEY = "cookie-consent-banner-shown";

const TEST_USER = {
  id: "user-123",
  email: "auth-test@fitvibe.test",
  password: "SecureP@ssw0rd123!",
  username: "authtest",
  role: "athlete",
};

const jsonResponse = (body, status = 200) => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const loginUserBody = (user = TEST_USER) => ({
  requires2FA: false,
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  },
  session: {
    id: "session-123",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
});

async function installCommonMocks(page) {
  await page.route("**/api/v1/csrf-token", async (route) => {
    await route.fulfill(jsonResponse({ csrfToken: "test-csrf-token" }));
  });
  await page.route("**/health", async (route) => {
    await route.fulfill(jsonResponse({ status: "ok" }));
  });
  await page.route("**/api/v1/consent/cookie-status", async (route) => {
    await route.fulfill(jsonResponse({ success: true, data: { hasConsent: true } }));
  });
  await page.route("**/api/v1/system/config", async (route) => {
    await route.fulfill(
      jsonResponse({
        readOnlyMode: false,
        maintenanceMode: false,
        maintenanceMessage: null,
        features: { socialFeed: true, coachDashboard: false, insights: true },
        timestamp: "2025-10-01T12:00:00.000Z",
      }),
    );
  });
  await page.route("**/api/v1/exercises**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill(jsonResponse({ data: [], total: 0, limit: 100, offset: 0 }));
  });
  await page.route("**/api/v1/sessions**", async (route) => {
    if (route.request().url().includes("/auth/sessions") || route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill(jsonResponse({ data: [], total: 0, limit: 50, offset: 0 }));
  });
  await page.route("**/api/v1/auth/2fa/status", async (route) => {
    await route.fulfill(jsonResponse({ enabled: false }));
  });
  await page.route("**/api/v1/auth/legal-documents/status", async (route) => {
    await route.fulfill(
      jsonResponse({
        terms: {
          accepted: true,
          acceptedAt: "2026-09-25T00:00:00.000Z",
          acceptedVersion: "2026-09-25.1",
          currentVersion: "2026-09-25.1",
          requiredVersion: "2026-09-25.1",
          requiredAction: "accept",
          needsAcceptance: false,
        },
        privacy: {
          accepted: true,
          acceptedAt: "2026-09-25T00:00:00.000Z",
          acceptedVersion: "2026-09-25.1",
          currentVersion: "2026-09-25.1",
          requiredVersion: null,
          requiredAction: "none",
          needsAcceptance: false,
        },
      }),
    );
  });
  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill(
      jsonResponse({
        id: "user-123",
        email: "auth-test@fitvibe.test",
        username: "authtest",
        roleCode: "athlete",
        status: "active",
      }),
    );
  });
}

async function preparePage(page, { authenticated = false } = {}) {
  await page.addInitScript(
    ({ authenticated: isAuthed, authKey, consentKey }) => {
      window.localStorage.setItem(consentKey, "true");
      if (isAuthed) {
        window.sessionStorage.setItem(authKey, "1");
      }
    },
    { authenticated, authKey: AUTH_FLAG_KEY, consentKey: CONSENT_KEY },
  );
  await installCommonMocks(page);
}

async function waitForApp(page) {
  await page.locator("#login-shell").waitFor({ state: "detached", timeout: 15_000 });
}

const emailInput = (page) => page.locator("form input[name='email']");
const passwordInput = (page) => page.locator("form input[name='password']");
const confirmPasswordInput = (page) => page.locator("form input[name='confirmPassword']");
const displayNameInput = (page) => page.locator("form input[name='name']");

async function acceptRegisterLegal(page) {
  const checkboxes = page.locator("form input[type='checkbox']");
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
}

module.exports = {
  AUTH_FLAG_KEY,
  TEST_USER,
  jsonResponse,
  loginUserBody,
  installCommonMocks,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
};
