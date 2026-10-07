const TEST_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@fitvibe.local",
  password: "admin",
  username: "admin",
  role: "admin",
};

const CONSENT_KEY = "cookie-consent-banner-shown";

async function installConsentPreference(page) {
  await page.addInitScript((consentKey) => {
    window.localStorage.setItem(consentKey, "true");
  }, CONSENT_KEY);
}

async function preparePage(page) {
  await installConsentPreference(page);
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

module.exports = {
  TEST_USER,
  preparePage,
  trackRequests,
  waitForApp,
  emailInput,
  passwordInput,
};
