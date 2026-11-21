"use strict";

// Reuse production component landmarks. Calendar intentionally uses the semantic
// <main> and role=grid rather than the data-app-surface marker of other pages.
const surfaceSelectors = Object.freeze({
  "/": '[data-app-surface="home"]',
  "/calendar": "main.calendar-surface[aria-labelledby='calendar-title']",
  "/library": '[data-app-surface="library"]',
  "/dashboard": '[data-app-surface="dashboard"]',
  "/settings": '[data-app-surface="settings"]',
});
function getPageReadySelector(pathname) {
  return surfaceSelectors[pathname] ?? '[data-component="legal-document-shell"]';
}
module.exports = { getPageReadySelector };
