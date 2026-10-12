import { createRequire } from "node:module";
import { test, expect, type Page } from "@playwright/test";
import { seedTheme } from "../helpers/auth.js";
import { getCurrentProject } from "../helpers/project.js";

const require = createRequire(import.meta.url);
const { assertComputedTypography } = require("../../../qa/assert-computed-typography.cjs") as {
  assertComputedTypography: (page: Page, theme: "light" | "dark") => Promise<void>;
};

test("athlete typography resolves to the shared Figma schema", async ({ page }, testInfo) => {
  const { theme } = getCurrentProject(testInfo);
  await seedTheme(page, theme);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-shell").waitFor({ state: "detached", timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await assertComputedTypography(page, theme);
});
