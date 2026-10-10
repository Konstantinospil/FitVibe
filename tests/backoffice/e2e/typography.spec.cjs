const { test, expect } = require("@playwright/test");
const { assertComputedTypography } = require("../../qa/assert-computed-typography.cjs");

for (const theme of ["light", "dark"]) {
  for (const width of [360, 1280]) {
    test("Backoffice computed typography: " + theme + " at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value) => {
        localStorage.setItem(
          "fitvibe:backoffice:theme",
          JSON.stringify({ state: { theme: value }, version: 1 }),
        );
      }, theme);
      // Authentication state is simulated; all typography is still loaded from real compiled CSS.
      await page.route("**/api/v1/csrf-token", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: '{"csrfToken":"test"}' }),
      );
      await page.route("**/api/v1/users/me", (route) =>
        route.fulfill({ status: 401, contentType: "application/json", body: '{"error":{"code":"UNAUTHENTICATED"}}' }),
      );
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: /fitvibe backoffice/i })).toBeVisible();
      await assertComputedTypography(page, theme);
    });
  }
}
