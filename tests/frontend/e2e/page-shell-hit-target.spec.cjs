const { test, expect } = require("./fixtures.cjs");
const { preparePage, waitForApp } = require("./server-helpers.cjs");

test("public shell keeps login action inside its interactive scroll region", async ({ page }) => {
  await preparePage(page);
  await page.goto("/login");
  await waitForApp(page);
  const action = page.getByRole("button", { name: /sign in/i });
  await expect(action).toBeVisible();
  await action.scrollIntoViewIfNeeded();
  const geometry = await action.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      withinViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
      hitTarget: hit === node || node.contains(hit),
    };
  });
  expect(geometry.withinViewport).toBe(true);
  expect(geometry.hitTarget).toBe(true);
});
