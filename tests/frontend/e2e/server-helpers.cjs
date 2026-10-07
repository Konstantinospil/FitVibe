const AUTH_FLAG_KEY = "fitvibe:auth";
const CONSENT_KEY = "cookie-consent-banner-shown";
const APPLICATION_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const APPLICATION_ORIGIN = new URL(APPLICATION_BASE_URL).origin;

const TEST_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@fitvibe.local",
  password: "admin",
  username: "admin",
  role: "admin",
};

let seededSessionCookies = null;

async function installBrowserState(page, { authenticated = false } = {}) {
  await page.addInitScript(
    ({ authKey, consentKey, authenticated: isAuthenticated }) => {
      window.localStorage.setItem(consentKey, "true");
      if (isAuthenticated) {
        window.sessionStorage.setItem(authKey, "1");
      }
    },
    {
      authKey: AUTH_FLAG_KEY,
      consentKey: CONSENT_KEY,
      authenticated,
    },
  );
}

async function createSeededSession(page) {
  const request = page.context().request;

  const csrfResponse = await request.get(`${APPLICATION_ORIGIN}/api/v1/csrf-token`);
  if (!csrfResponse.ok()) {
    throw new Error(`Unable to acquire E2E CSRF token: HTTP ${csrfResponse.status()}`);
  }
  const { csrfToken } = await csrfResponse.json();

  const loginResponse = await request.post(`${APPLICATION_ORIGIN}/api/v1/auth/login`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
    headers: {
      Origin: APPLICATION_ORIGIN,
      "X-CSRF-Token": csrfToken,
    },
  });
  if (!loginResponse.ok()) {
    throw new Error(`Unable to create seeded E2E session: HTTP ${loginResponse.status()}`);
  }

  const loginBody = await loginResponse.json();
  if (loginBody.requires2FA !== false) {
    throw new Error("Seeded E2E user unexpectedly requires 2FA");
  }

  seededSessionCookies = await page.context().cookies(APPLICATION_ORIGIN);
}

async function ensureSeededSession(page) {
  if (seededSessionCookies) {
    await page.context().addCookies(seededSessionCookies);
    const sessionCheck = await page.context().request.get(
      `${APPLICATION_ORIGIN}/api/v1/users/me`,
    );
    if (sessionCheck.ok()) {
      return;
    }
    seededSessionCookies = null;
    await page.context().clearCookies();
  }

  await createSeededSession(page);
}

async function preparePage(page, { authenticated = false } = {}) {
  await installBrowserState(page, { authenticated });
  if (authenticated) {
    await ensureSeededSession(page);
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
  trackRequests,
  waitForApp,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  displayNameInput,
  acceptRegisterLegal,
};
