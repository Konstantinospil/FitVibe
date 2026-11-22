"use strict";
const { backofficeRoutes } = require("./lighthouse-routes.cjs");

// These selectors are owned by the existing backoffice pages/components.
// A matching URL alone is never evidence of a rendered, authorized page.
const routeContracts = Object.freeze({
  "/login": {
    mode: "backoffice-public",
    heading: "h1",
    fields: ['form input[type="email"]', 'form input[type="password"]', 'form button[type="submit"]'],
    api: "/api/v1/csrf-token",
  },
  "/translations": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/translations",
  },
  "/legal-publications": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/legal/publications",
  },
  "/messages": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/contact/messages",
  },
  "/audit-logs": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/logs",
  },
  "/settings": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/system/config",
  },
  "/users": {
    mode: "backoffice-admin", heading: "main.backoffice-main h1",
    api: "/api/v1/admin/users/search",
  },
  "/admin/reports": {
    mode: "backoffice-admin", heading: 'main.backoffice-main [data-component="card-title"]',
    api: "/api/v1/admin/reports",
  },
  "/superadmin/privileges": {
    mode: "backoffice-superadmin",
    heading: 'main.backoffice-main [data-component="card-title"]',
    api: "/api/v1/admin/superadmin/privileges/admins",
  },
});

function assertBackofficeInventory() {
  const declared = backofficeRoutes.map(({ mode, path }) => mode + ":" + path).sort();
  const contracted = Object.entries(routeContracts)
    .map(([path, contract]) => contract.mode + ":" + path).sort();
  if (declared.length !== contracted.length ||
      declared.some((entry, index) => entry !== contracted[index])) {
    throw new Error("Backoffice Lighthouse readiness contracts do not cover the route inventory");
  }
}

async function verifyBackofficeContent(page, pathname) {
  const contract = routeContracts[pathname];
  if (!contract) throw new Error("Missing backoffice readiness contract for " + pathname);
  const heading = page.locator(contract.heading).first();
  await heading.waitFor({ state: "visible", timeout: 30000 });
  if (!(await heading.textContent())?.trim()) {
    throw new Error(pathname + ": empty rendered page heading");
  }
  for (const selector of contract.fields ?? []) {
    await page.locator(selector).waitFor({ state: "visible", timeout: 30000 });
  }
  for (const selector of [
    'main.backoffice-main [role="alert"]:visible',
    'main.backoffice-main [aria-busy="true"]:visible',
  ]) {
    if (await page.locator(selector).count()) {
      throw new Error(pathname + ": error or unresolved loading state " + selector);
    }
  }
  if (pathname !== "/login" && await page.locator('form input[type="password"]:visible').count()) {
    throw new Error(pathname + ": login form replaced the protected page");
  }
}

function assessBackofficeReport(report, pathname, origin, { hasSession }) {
  const contract = routeContracts[pathname];
  if (!contract) return ["Missing backoffice report contract for " + pathname];
  const errors = [];
  const requests = report?.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(requests)) return ["Missing Lighthouse network request evidence"];
  const api = requests.filter((item) => {
    try {
      const url = new URL(item.url);
      return url.origin === origin && url.pathname.startsWith("/api/v1/");
    } catch { return false; }
  });
  const statusFor = (path) => api.filter((item) => new URL(item.url).pathname === path)
    .map((item) => item.statusCode);
  if (pathname === "/login" && hasSession) {
    errors.push("Public backoffice login must be audited in an anonymous browser session");
  }
  if (pathname !== "/login") {
    if (!hasSession) errors.push("Protected backoffice audit has no verified session");
    if (!statusFor("/api/v1/users/me").includes(200)) {
      errors.push("Missing real authorized /api/v1/users/me response");
    }
  }
  if (!statusFor(contract.api).some((status) => Number.isInteger(status) &&
      status >= 200 && status < 300)) {
    errors.push("Missing successful real backend response for " + contract.api);
  }
  for (const item of api) {
    if (!Number.isInteger(item.statusCode) ||
        (pathname !== "/login" && item.statusCode >= 400) ||
        (pathname === "/login" && item.statusCode >= 400 &&
          !(new URL(item.url).pathname === "/api/v1/users/me" && item.statusCode === 401))) {
      errors.push("Unexpected backend HTTP " + item.statusCode + " on " +
        new URL(item.url).pathname);
    }
  }
  return errors;
}

assertBackofficeInventory();
module.exports = {
  routeContracts, assertBackofficeInventory, verifyBackofficeContent, assessBackofficeReport,
};
