"use strict";

/**
 * Observe the tab Lighthouse itself opens. This is deliberately separate from
 * the setup/preflight page: only a real navigation to the requested URL can
 * generate a readiness record. Do not create or navigate another tab here.
 */
function observeNavigation(context, requestedUrl, verifyPage, collectDiagnostics) {
  const tasks = [];
  const expectedOrigin = new URL(requestedUrl).origin;
  const watched = new Map();
  const seen = new Set();
  const apiResponses = new Map();
  const responseListeners = new Map();

  const inspect = (page, frame) => {
    if (seen.has(page) || frame !== page.mainFrame() ||
        frame.url() !== requestedUrl) return;
    seen.add(page);
    // Capture the outcome, including failure, rather than dropping a rejected
    // promise or turning a browser crash into a successful measurement.
    tasks.push(Promise.resolve().then(async () => {
      await verifyPage(page);
      if (page.url() !== requestedUrl) {
        throw new Error("Measured browser tab navigated away from " + requestedUrl);
      }
      // Diagnostics must never invalidate an otherwise valid performance run.
      let diagnostics;
      if (collectDiagnostics) {
        try {
          diagnostics = await collectDiagnostics(page, apiResponses.get(page) ?? []);
        } catch {
          diagnostics = { diagnosticError: "Navigation timing unavailable" };
        }
      }
      return {
        requestedUrl, ready: true, observedUrl: page.url(),
        ...(diagnostics === undefined ? {} : { diagnostics }),
      };
    }).then(
      (result) => result,
      (error) => ({ requestedUrl, ready: false, error: error.message }),
    ));
  };

  const onPage = (page) => {
    const onFrame = (frame) => inspect(page, frame);
    watched.set(page, onFrame);
    const responses = [];
    apiResponses.set(page, responses);
    const onResponse = (response) => {
      try {
        const url = new URL(response.url());
        if (url.origin !== expectedOrigin || !isSafeApiPath(url.pathname)) return;
        // Keep only paths and statuses: no queries, credentials, bodies or PII.
        responses.push({ path: url.pathname, status: response.status() });
      } catch {
        // Ignore internal browser URLs.
      }
    };
    responseListeners.set(page, onResponse);
    page.on("response", onResponse);
    page.on("framenavigated", onFrame);
    inspect(page, page.mainFrame());
  };
  context.on("page", onPage);

  return {
    async finish() {
      context.off("page", onPage);
      for (const [page, callback] of watched) {
        page.off("framenavigated", callback);
        page.off("response", responseListeners.get(page));
      }
      const observations = await Promise.all(tasks);
      if (observations.length !== 1 || observations[0].ready !== true) {
        throw new Error("Missing or failed same-navigation browser readiness for " +
          requestedUrl + ": " + JSON.stringify(observations));
      }
      return observations[0];
    },
  };
}

/**
 * Read existing browser timing entries from the exact Lighthouse tab.
 * This diagnostic does not create navigations or change Lighthouse throttling.
 * Missing entries stay null, not fabricated zero-duration observations.
 */
// Never retain dynamic API path segments that can contain private identifiers.
const SAFE_API_PATHS = new Set([
  "/api/v1/auth/legal-documents/status",
  "/api/v1/auth/admin-password/status",
  "/api/v1/users/me/preferences",
  "/api/v1/consent/cookie-status",
]);
function isSafeApiPath(pathname) {
  return SAFE_API_PATHS.has(pathname);
}

async function collectNavigationDiagnostics(page, responses) {
  const timings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    const marks = performance.getEntriesByType("mark")
      .filter((entry) => entry.name.startsWith("fitvibe:"))
      .map((entry) => ({ name: entry.name, startMs: Math.round(entry.startTime) }));
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => {
        try {
          const url = new URL(entry.name);
          return url.origin === location.origin && [
            "/api/v1/auth/legal-documents/status",
            "/api/v1/auth/admin-password/status",
            "/api/v1/users/me/preferences",
            "/api/v1/consent/cookie-status",
          ].includes(url.pathname);
        } catch {
          return false;
        }
      })
      .map((entry) => ({
        path: new URL(entry.name).pathname,
        startMs: Math.round(entry.startTime),
        durationMs: Math.round(entry.duration),
      }));
    const firstContentfulPaint = paint.find((entry) => entry.name === "first-contentful-paint");
    return {
      readyAtMs: Math.round(performance.now()),
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      responseEndMs: navigation ? Math.round(navigation.responseEnd) : null,
      firstContentfulPaintMs: firstContentfulPaint
        ? Math.round(firstContentfulPaint.startTime) : null,
      marks,
      resources,
    };
  });
  return { ...timings, apiResponses: responses };
}

module.exports = { observeNavigation, collectNavigationDiagnostics, isSafeApiPath };
