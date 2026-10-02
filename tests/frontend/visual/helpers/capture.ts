import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { freezeTime } from "./fakeClock.js";
import { getDynamicMasks } from "./mask.js";
import { assertNoHorizontalOverflow } from "./responsive.js";
import {
  dismissCookieBanner,
  gotoAuthenticated,
  seedTheme,
  setupAuthenticatedState,
} from "./auth.js";
import { installDefaultMocks } from "./mockApi.js";
import {
  getCurrentProject,
  skipUnlessMatrix,
  type VisualTheme,
  type VisualViewport,
} from "./project.js";

const pageErrors = new WeakMap<Page, string[]>();
const pageAuth = new WeakMap<Page, boolean>();

export async function prepareVisualPage(
  page: Page,
  testInfo: TestInfo,
  options?: { authenticated?: boolean },
): Promise<void> {
  const { theme } = getCurrentProject(testInfo);
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);
  const errors: string[] = [];
  pageErrors.set(page, errors);
  pageAuth.set(page, Boolean(options?.authenticated));
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.warn(`[visual] pageerror: ${error.message}`);
  });
  await freezeTime(page);
  // Fonts inject on requestIdleCallback (up to 3s). Flush immediately so
  // screenshots capture Inter / Roboto Flex instead of system fallbacks.
  await page.addInitScript(() => {
    const flushIdle = (callback: IdleRequestCallback) =>
      window.setTimeout(() => {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }, 0);
    window.requestIdleCallback = flushIdle as typeof window.requestIdleCallback;
  });
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent =
      "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";
    const inject = () => {
      if (!document.head) {
        return false;
      }
      document.head.appendChild(style);
      return true;
    };
    if (!inject()) {
      const observer = new MutationObserver(() => {
        if (inject()) {
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  await seedTheme(page, theme);
  await dismissCookieBanner(page);
  await installDefaultMocks(page);
  if (options?.authenticated) {
    await setupAuthenticatedState(page);
  }
}

async function waitForVisualAssets(page: Page): Promise<void> {
  const authenticated = pageAuth.get(page) ?? false;
  await page.locator("#async-fonts").waitFor({ state: "attached", timeout: 10_000 });
  if (authenticated) {
    await page.locator("#async-fonts-app").waitFor({ state: "attached", timeout: 10_000 });
  }
  await page.evaluate(async (loadHeadings: boolean) => {
    const root = document.documentElement;

    const primaryFontUrl = (styleId: string, family: string): string => {
      const css = document.getElementById(styleId)?.textContent;
      if (!css) {
        throw new Error(`Visual font stylesheet #${styleId} is missing`);
      }
      const familyIndex = css.indexOf(`font-family: "${family}"`);
      const blockStart = css.lastIndexOf("@font-face", familyIndex);
      const blockEnd = css.indexOf("}", familyIndex);
      if (familyIndex < 0 || blockStart < 0 || blockEnd < 0) {
        throw new Error(`Visual font face for ${family} was not found in #${styleId}`);
      }
      const fontFaceBlock = css.slice(blockStart, blockEnd + 1);
      const source = fontFaceBlock.match(/src:\\s*url\\("([^"]+)"\\)/)?.[1];
      if (!source) {
        throw new Error(`Visual font source for ${family} was not found in #${styleId}`);
      }
      return new URL(source, document.baseURI).href;
    };

    const ensureVisualFont = async (
      alias: string,
      styleId: string,
      family: string,
      weight: string,
    ): Promise<void> => {
      if (document.fonts.check(`400 16px "${alias}"`)) {
        return;
      }
      const source = primaryFontUrl(styleId, family);
      const face = new FontFace(alias, `url("${source}") format("woff2-variations")`, {
        style: "normal",
        weight,
        display: "block",
      });
      await face.load();
      document.fonts.add(face);
    };

    // Production keeps font-display: optional/swap for performance. Visual tests
    // load the exact same font files under deterministic aliases so screenshots
    // never race fallback-font layout against the final webfont layout.
    await ensureVisualFont("FitVibe Visual Inter", "async-fonts", "Inter", "100 900");
    root.style.setProperty(
      "--font-family-body",
      '"FitVibe Visual Inter", system-ui, sans-serif',
    );
    root.style.setProperty("--font-family-base", "var(--font-family-body)");

    if (loadHeadings) {
      await ensureVisualFont(
        "FitVibe Visual Heading",
        "async-fonts-app",
        "Roboto Flex",
        "100 1000",
      );
      root.style.setProperty(
        "--font-family-heading",
        '"FitVibe Visual Heading", "FitVibe Visual Inter", system-ui, sans-serif',
      );
    } else {
      root.style.setProperty(
        "--font-family-heading",
        '"FitVibe Visual Inter", system-ui, sans-serif',
      );
    }

    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  }, authenticated);
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#login-shell").waitFor({ state: "detached", timeout: 10_000 });
  const bootErrors = pageErrors.get(page);
  if (bootErrors?.length) {
    throw new Error(`App failed to boot: ${bootErrors.join("; ")}`);
  }
  await waitForVisualAssets(page);
}

export async function capturePageScreenshot(
  page: Page,
  _testInfo: TestInfo,
  name: string,
  options?: { locator?: Locator; fullPage?: boolean; waitFor?: string },
): Promise<void> {
  await waitForAppReady(page);
  if (options?.waitFor) {
    await page.locator(options.waitFor).first().waitFor({ state: "visible", timeout: 15_000 });
  }
  await waitForVisualAssets(page);
  await page
    .locator('[aria-label="Switch to light mode"], [aria-label="Switch to dark mode"]')
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  if (!options?.locator) {
    await assertNoHorizontalOverflow(page);
  }
  const masks = await getDynamicMasks(page);
  const target = options?.locator ?? page;
  await expect(target).toHaveScreenshot(`${name}.png`, {
    mask: masks,
    fullPage: options?.locator ? false : (options?.fullPage ?? true),
    animations: "disabled",
    timeout: 15_000,
  });
}

export async function openAuthenticatedPage(
  page: Page,
  testInfo: TestInfo,
  url: string,
  matrix: { themes?: VisualTheme[]; viewports?: VisualViewport[] },
): Promise<void> {
  skipUnlessMatrix(testInfo, matrix);
  await prepareVisualPage(page, testInfo, { authenticated: true });
  await gotoAuthenticated(page, url);
  await expect(page).not.toHaveURL(/\/login/);
  await page.locator("header nav").first().waitFor({ state: "visible", timeout: 15_000 });
}

export async function openPublicPage(
  page: Page,
  testInfo: TestInfo,
  url: string,
  matrix: { themes?: VisualTheme[]; viewports?: VisualViewport[] },
): Promise<void> {
  skipUnlessMatrix(testInfo, matrix);
  await prepareVisualPage(page, testInfo, { authenticated: false });
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
