const { test, expect } = require("@playwright/test");

const json = (body, status = 200) => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function mockCsrf(page) {
  await page.route("**/api/v1/csrf-token", (route) =>
    route.fulfill(json({ csrfToken: "backoffice-test-csrf" })),
  );
}

test.describe("Backoffice privilege wall", () => {
  test("unauthenticated access to a protected route redirects to login", async ({ page }) => {
    await mockCsrf(page);
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill(json({ error: { code: "UNAUTHENTICATED" } }, 401)),
    );

    await page.goto("/translations");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /fitvibe backoffice/i })).toBeVisible();
  });

  test("non-admin session is not admitted to protected routes", async ({ page }) => {
    await mockCsrf(page);
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill(
        json({
          id: "athlete-1",
          username: "athlete",
          displayName: "Athlete",
          primaryEmail: "athlete@fitvibe.test",
          role: "athlete",
        }),
      ),
    );

    await page.goto("/translations");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /fitvibe backoffice/i })).toBeVisible();
  });

  test("admin session can reach the protected translations surface", async ({ page }) => {
    await mockCsrf(page);
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill(
        json({
          id: "admin-1",
          username: "admin",
          displayName: "Admin",
          primaryEmail: "admin@fitvibe.test",
          role: "admin",
        }),
      ),
    );
    await page.route("**/api/v1/translations/metadata", (route) =>
      route.fulfill(json({ data: { languages: ["en"], namespaces: ["common"] } })),
    );
    await page.route("**/api/v1/translations/namespace-updates", (route) =>
      route.fulfill(json({ data: [] })),
    );
    await page.route(/\/api\/v1\/translations(?:\?.*)?$/, (route) =>
      route.fulfill(json({ data: [], pagination: { total: 0, limit: 500, offset: 0 } })),
    );

    await page.goto("/translations");
    await expect(page).toHaveURL(/\/translations$/);
    await expect(page.getByText(/translations/i).first()).toBeVisible();
  });
});
