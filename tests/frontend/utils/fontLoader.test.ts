/**
 * Font Loader tests
 * Faces are registered through the CSS Font Loading API (#650): an injected
 * <style> is blocked by the production CSP, FontFace objects are not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  APP_FONT_MARKER_ID,
  PUBLIC_FONT_MARKER_ID,
  PUBLIC_FONT_FACES,
  loadAppFonts,
  loadFontsAsync,
  loadPublicFonts,
} from "../../src/utils/fontLoader.js";
import { APP_FONT_FACES } from "../../src/utils/appFontLoader.js";

interface RecordedFace {
  family: string;
  source: string;
  descriptors: FontFaceDescriptors;
}

class FakeFontFace {
  constructor(
    readonly family: string,
    readonly source: string,
    readonly descriptors: FontFaceDescriptors,
  ) {}
}

const idleNow = () => {
  // @ts-expect-error - requestIdleCallback may not exist in all environments
  window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 16.67 }), 0);
    return 1;
  });
};

describe("fontLoader", () => {
  let added: RecordedFace[];
  let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalFonts: PropertyDescriptor | undefined;

  const clearMarkers = () => {
    document.getElementById(PUBLIC_FONT_MARKER_ID)?.remove();
    document.getElementById(APP_FONT_MARKER_ID)?.remove();
    document.body.classList.remove("fonts-loaded");
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clearMarkers();
    added = [];
    vi.stubGlobal("FontFace", FakeFontFace);
    originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { add: vi.fn((face: RecordedFace) => added.push(face)) },
    });
    originalRequestIdleCallback = window.requestIdleCallback;
    originalRequestAnimationFrame = window.requestAnimationFrame;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearMarkers();
    if (originalFonts) {
      Object.defineProperty(document, "fonts", originalFonts);
    } else {
      // @ts-expect-error - remove the test stub when jsdom had no FontFaceSet
      delete document.fonts;
    }
    if (originalRequestIdleCallback) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
    window.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it("should return early when window is undefined (SSR)", () => {
    const originalWindow = global.window;
    // @ts-expect-error - intentionally setting window to undefined for SSR test
    global.window = undefined;

    try {
      expect(() => loadFontsAsync()).not.toThrow();
      expect(added).toHaveLength(0);
    } finally {
      global.window = originalWindow;
    }
  });

  it("should do nothing when the Font Loading API is unavailable", () => {
    idleNow();
    vi.stubGlobal("FontFace", undefined);

    loadPublicFonts();
    vi.advanceTimersByTime(1);

    expect(added).toHaveLength(0);
    expect(document.getElementById(PUBLIC_FONT_MARKER_ID)).toBeNull();
  });

  it("should use requestIdleCallback when available", () => {
    idleNow();

    loadFontsAsync();

    expect(window.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 3000,
    });
    vi.advanceTimersByTime(1);
    expect(added.map((face) => face.family)).toEqual(["Inter", "Inter", "Inter"]);
  });

  it("should fallback to setTimeout when requestIdleCallback is not available", () => {
    // @ts-expect-error - intentionally removing requestIdleCallback
    delete window.requestIdleCallback;

    loadFontsAsync();
    vi.advanceTimersByTime(1999);
    expect(added).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(added).toHaveLength(3);
  });

  it("should register faces with the Font Loading API instead of an inline <style>", () => {
    idleNow();

    loadPublicFonts();
    vi.advanceTimersByTime(1);

    expect(document.querySelector("style")).toBeNull();
    for (const face of added) {
      expect(face).toBeInstanceOf(FakeFontFace);
      expect(face.source).toMatch(/^url\(".+\.woff2"\) format\("woff2-variations"\)$/);
      expect(face.descriptors.unicodeRange).toBeTruthy();
      expect(face.descriptors.weight).toBe("100 900");
    }
    expect(added.map((face) => face.descriptors.unicodeRange)).toEqual(
      PUBLIC_FONT_FACES.map((face) => face.unicodeRange),
    );
  });

  it("should register Inter only on public pages", () => {
    idleNow();

    loadPublicFonts();
    vi.advanceTimersByTime(1);

    expect(added.every((face) => face.family === "Inter")).toBe(true);
    expect(added.some((face) => face.source.includes(".ttf"))).toBe(false);
  });

  it("should not register fonts twice", () => {
    idleNow();

    loadFontsAsync();
    vi.advanceTimersByTime(1);
    loadFontsAsync();
    vi.advanceTimersByTime(1);

    expect(added).toHaveLength(3);
    expect(document.querySelectorAll(`#${PUBLIC_FONT_MARKER_ID}`)).toHaveLength(1);
  });

  it("should record the registered faces on a CSP-neutral <meta> marker", () => {
    idleNow();

    loadPublicFonts();
    vi.advanceTimersByTime(1);

    const marker = document.getElementById(PUBLIC_FONT_MARKER_ID);
    expect(marker?.tagName).toBe("META");
    expect(marker?.parentElement).toBe(document.head);
    expect(JSON.parse(marker?.getAttribute("content") ?? "[]")).toEqual(PUBLIC_FONT_FACES);
  });

  it("should add fonts-loaded class to body after registration", () => {
    idleNow();
    const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      setTimeout(callback, 0);
      return 1;
    });
    window.requestAnimationFrame = mockRequestAnimationFrame;

    loadFontsAsync();
    vi.advanceTimersByTime(1);
    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(document.body.classList.contains("fonts-loaded")).toBe(true);
  });

  it("should register Roboto Flex only via loadAppFonts", async () => {
    idleNow();

    loadAppFonts();
    await vi.runAllTimersAsync();

    expect(added.map((face) => face.family)).toEqual(["Roboto Flex", "Roboto Flex", "Roboto Flex"]);
    expect(added.every((face) => face.descriptors.display === "swap")).toBe(true);
    expect(added.every((face) => face.descriptors.weight === "100 1000")).toBe(true);
    expect(document.getElementById(APP_FONT_MARKER_ID)?.tagName).toBe("META");
    expect(APP_FONT_FACES.every((face) => face.family === "Roboto Flex")).toBe(true);
  });

  it("should handle requestIdleCallback timeout", () => {
    // @ts-expect-error - requestIdleCallback may not exist in all environments
    window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 3000);
      return 1;
    });

    loadFontsAsync();
    vi.advanceTimersByTime(3000);

    expect(added).toHaveLength(3);
  });

  it("should use font-display optional so late Inter cannot become LCP", () => {
    idleNow();

    loadFontsAsync();
    vi.advanceTimersByTime(1);

    expect(added.every((face) => face.descriptors.display === "optional")).toBe(true);
  });
});
