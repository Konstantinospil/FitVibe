"use strict";

// Route inventory from frontend/src/routes/{PublicRoutes,ProtectedRoutes}.tsx.
// Keep conditional states separate: measuring a missing-token/error page as if
// it were the intended successful journey would give misleading evidence.
const publicRoutes = [
  "/", "/login", "/register", "/forgot-password",
  "/terms", "/privacy", "/cookie", "/contact",
];
const athleteRoutes = [
  "/", "/calendar", "/library", "/dashboard", "/settings",
  "/terms", "/privacy", "/cookie",
];
const conditionalRoutes = [
  { mode: "public", path: "/login/verify-2fa", fixture: "pending two-factor challenge" },
  { mode: "public", path: "/verify", fixture: "unconsumed email-verification token" },
  { mode: "public", path: "/reset-password", fixture: "unconsumed password-reset token" },
  { mode: "public", path: "/terms-reacceptance", fixture: "authenticated legal reacceptance" },
  { mode: "athlete", path: "/terms-reacceptance", fixture: "outdated accepted legal version" },
  { mode: "athlete", path: "/admin/password-update", fixture: "administrator password-policy gate" },
];
// Backoffice has an independent admin session and must not be represented by
// the athlete fixture. These are tracked but not yet collected.
const backofficeRoutes = [
  { mode: "backoffice-public", path: "/login" },
  { mode: "backoffice-admin", path: "/translations" },
  { mode: "backoffice-admin", path: "/legal-publications" },
  { mode: "backoffice-admin", path: "/messages" },
  { mode: "backoffice-admin", path: "/audit-logs" },
  { mode: "backoffice-admin", path: "/settings" },
  { mode: "backoffice-admin", path: "/users" },
  { mode: "backoffice-admin", path: "/admin/reports" },
  { mode: "backoffice-superadmin", path: "/superadmin/privileges" },
];
const auditedRoutes = [
  ...publicRoutes.map((path) => ({ mode: "public", path })),
  ...athleteRoutes.map((path) => ({ mode: "athlete", path })),
];

function auditUrl(route, origin = "http://127.0.0.1:4180") {
  const url = new URL(route.path, origin);
  url.searchParams.set("lhci", route.mode);
  return url.toString();
}

module.exports = { publicRoutes, athleteRoutes, conditionalRoutes, backofficeRoutes, auditedRoutes, auditUrl };
