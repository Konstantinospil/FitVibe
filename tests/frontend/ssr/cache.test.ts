/**
 * SSR cache tests
 * Tests HTML caching functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type * as NodeFs from "node:fs";
import { env as nodeProcessEnv } from "node:process";

// Use vi.hoisted to create mocks that are available before module import
const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockMkdirSync, mockStatSync } =
  vi.hoisted(() => {
    return {
      mockExistsSync: vi.fn(() => false),
      mockReadFileSync: vi.fn(),
      mockWriteFileSync: vi.fn(),
      mockMkdirSync: vi.fn(),
      mockStatSync: vi.fn(() => ({
        mtimeMs: Date.now(),
      })),
    };
  });

// Mock node:fs using hoisted mocks
vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof NodeFs;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    statSync: mockStatSync,
  };
});

// Import cache module AFTER mocks are set up
import { isCacheableRoute, getCachedHtml, setCachedHtml, clearCache } from "../../src/ssr/cache.js";

// Helper to get mocks
const getMocks = () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  statSync: mockStatSync,
});

describe("SSR cache", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clearCache();
    vi.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockImplementation(() => ({ mtimeMs: Date.now() }));
    nodeProcessEnv.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    nodeProcessEnv.NODE_ENV = originalEnv;
    clearCache();
  });

  it("should identify cacheable routes", () => {
    expect(isCacheableRoute("/login")).toBe(true);
    expect(isCacheableRoute("/register")).toBe(true);
    expect(isCacheableRoute("/terms")).toBe(true);
    expect(isCacheableRoute("/privacy")).toBe(true);
    expect(isCacheableRoute("/")).toBe(false);
    expect(isCacheableRoute("/sessions")).toBe(false);
  });

  it("should cache and retrieve HTML", () => {
    const url = "/login";
    const html = "<html><body>Test</body></html>";

    setCachedHtml(url, html);
    const cached = getCachedHtml(url);

    expect(cached).toBe(html);
  });

  it("should return null for non-cached routes", () => {
    const cached = getCachedHtml("/nonexistent");
    expect(cached).toBeNull();
  });

  it("should clear cache", () => {
    setCachedHtml("/login", "<html>Test</html>");
    clearCache();
    const cached = getCachedHtml("/login");
    expect(cached).toBeNull();
  });

  it("should handle expired memory cache", () => {
    const url = "/login";
    const html = "<html><body>Test</body></html>";

    // Set cache first
    setCachedHtml(url, html);

    // Manually expire it by setting old timestamp
    // We need to access the internal memory cache
    // Since we can't access it directly, we'll use vi.useFakeTimers to simulate time passing
    vi.useFakeTimers();
    setCachedHtml(url, html);
    vi.advanceTimersByTime(6 * 60 * 1000); // Advance 6 minutes
    const cached = getCachedHtml(url);

    // Should return null for expired cache
    expect(cached).toBeNull();
  });

  it("should handle cacheable routes with query strings", () => {
    expect(isCacheableRoute("/login?redirect=/dashboard")).toBe(true);
    expect(isCacheableRoute("/register?token=abc")).toBe(true);
  });

  it("should handle non-cacheable routes", () => {
    expect(isCacheableRoute("/dashboard")).toBe(false);
    expect(isCacheableRoute("/sessions/123")).toBe(false);
    expect(isCacheableRoute("/profile")).toBe(false);
  });

  it("should test generateStaticPages", async () => {
    const { generateStaticPages } = await import("../../src/ssr/cache.js");
    const mockRenderPage = vi.fn().mockResolvedValue("<html>Test</html>");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await generateStaticPages(mockRenderPage);

    expect(mockRenderPage).toHaveBeenCalledTimes(8); // 8 public routes
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should handle generateStaticPages errors", async () => {
    const { generateStaticPages } = await import("../../src/ssr/cache.js");
    const mockRenderPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Render error"))
      .mockResolvedValue("<html>Test</html>");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await generateStaticPages(mockRenderPage);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to generate"),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("reads fresh disk HTML in production and serves subsequent requests from memory", () => {
    nodeProcessEnv.NODE_ENV = "production";
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 1000 } as NodeFs.Stats);
    mockReadFileSync.mockReturnValue("<html>from disk</html>");

    expect(getCachedHtml("/privacy")).toBe("<html>from disk</html>");
    expect(getCachedHtml("/privacy")).toBe("<html>from disk</html>");
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
  });

  it("does not serve an expired disk file", () => {
    nodeProcessEnv.NODE_ENV = "production";
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 6 * 60 * 1000 } as NodeFs.Stats);

    expect(getCachedHtml("/terms")).toBeNull();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("writes production HTML to disk using a canonical path without query parameters", () => {
    nodeProcessEnv.NODE_ENV = "production";
    setCachedHtml("/reset-password?token=sensitive", "<html>reset</html>");

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/reset-password\.html$/),
      "<html>reset</html>",
      "utf-8",
    );
    expect(mockWriteFileSync.mock.calls[0][0]).not.toContain("sensitive");
  });

  it("keeps the memory cache usable when the production disk write fails", () => {
    nodeProcessEnv.NODE_ENV = "production";
    mockWriteFileSync.mockImplementation(() => { throw new Error("disk full"); });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    setCachedHtml("/verify", "<html>verified</html>");
    expect(getCachedHtml("/verify")).toBe("<html>verified</html>");
    expect(warn).toHaveBeenCalledWith("Failed to write cache to disk:", expect.any(Error));
    warn.mockRestore();
  });

  it("ignores disk metadata errors and regenerates rather than serving uncertain HTML", () => {
    nodeProcessEnv.NODE_ENV = "production";
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockImplementation(() => { throw new Error("file disappeared"); });

    expect(getCachedHtml("/login")).toBeNull();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("should not write to disk cache in non-production mode", () => {
    process.env.NODE_ENV = "development";
    const mocks = getMocks();
    const url = "/login";
    const html = "<html><body>Test</body></html>";

    setCachedHtml(url, html);

    expect(mocks.writeFileSync).not.toHaveBeenCalled();
    // But should still be in memory cache
    expect(getCachedHtml(url)).toBe(html);
  });

  it("should handle disk cache read errors gracefully", () => {
    clearCache(); // Clear memory cache first
    nodeProcessEnv.NODE_ENV = "production";
    const mocks = getMocks();
    const url = "/forgot-password"; // Use different URL to avoid memory cache conflicts

    // Reset mocks
    mocks.existsSync.mockClear();
    mocks.readFileSync.mockClear();
    mocks.statSync.mockClear();

    // Mock disk cache exists but read fails
    mocks.existsSync.mockReturnValue(true);
    mocks.statSync.mockReturnValue({
      mtimeMs: Date.now() - 1000, // Fresh
    } as NodeFs.Stats);
    mocks.readFileSync.mockImplementation(() => {
      throw new Error("Read error");
    });

    const cached = getCachedHtml(url);

    // Should return null on error, not throw
    // The error is caught in the try-catch, so it returns null
    expect(cached).toBeNull();
  });

  it("should handle case-insensitive route matching", () => {
    expect(isCacheableRoute("/LOGIN")).toBe(true);
    expect(isCacheableRoute("/Register")).toBe(true);
    expect(isCacheableRoute("/TERMS")).toBe(true);
  });

  it("should handle routes with query parameters in cache path", () => {
    const url = "/login?redirect=/dashboard";
    const html = "<html><body>Test</body></html>";

    setCachedHtml(url, html);
    const cached = getCachedHtml(url);

    expect(cached).toBe(html);
  });
});
