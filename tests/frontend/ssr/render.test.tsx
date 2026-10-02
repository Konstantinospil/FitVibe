/**
 * SSR render tests
 * Tests server-side rendering functionality
 */

import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type * as NodeFs from "node:fs";
import { renderPage } from "../../src/ssr/render.js";

// Mock dependencies
const { prefetchQuery } = vi.hoisted(() => ({
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-dom/server", () => ({
  renderToString: vi.fn(() => "<div>Rendered App</div>"),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    dehydrate: vi.fn(() => ({ queries: [] })),
  };
});

vi.mock("../../src/routes/Router.js", () => ({
  Router: ({ location }: { location: string }) => <div>Router: {location}</div>,
}));

vi.mock("../../src/contexts/ToastContext.js", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../src/lib/queryClient.js", () => ({
  createQueryClient: vi.fn(() => ({
    prefetchQuery,
  })),
}));

vi.mock("../../src/services/api.js", () => ({
  listSessions: vi.fn(),
  listExercises: vi.fn(),
  getProgressTrends: vi.fn(),
  getExerciseBreakdown: vi.fn(),
  getFeed: vi.fn(),
}));

const mockI18n = {
  isInitialized: true,
  language: "en",
  changeLanguage: vi.fn(),
  on: vi.fn(),
};

vi.mock("../../src/i18n/config.js", () => ({
  default: mockI18n,
  minimalTranslationsReady: Promise.resolve(),
}));

// Mock node:fs
vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof NodeFs;
  return {
    ...actual,
    readFileSync: vi.fn(
      () =>
        '<html><body><div id="root"></div><script type="module" src="/src/bootstrap.ts"></script></body></html>',
    ),
    existsSync: vi.fn(() => false),
  };
});

vi.mock("node:path", async (importOriginal) => {
  const actual = await vi.importActual("node:path");
  return actual;
});

vi.mock("node:url", async (importOriginal) => {
  const actual = await vi.importActual("node:url");
  return actual;
});

describe("SSR render", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("should render page for home route", async () => {
    const html = await renderPage("/");

    expect(html).toContain("Rendered App");
    expect(html).toContain('id="fitvibe-react-query-state"');
    expect(html).not.toContain("window.__REACT_QUERY_STATE__");
  });

  it("should render page for sessions route", async () => {
    const html = await renderPage("/sessions");

    expect(html).toContain("Rendered App");
  });

  it("should render page for planner route", async () => {
    const html = await renderPage("/planner");

    expect(html).toContain("Rendered App");
  });

  it("should render page for insights route", async () => {
    const html = await renderPage("/insights");

    expect(html).toContain("Rendered App");
  });

  it("should render page for progress route", async () => {
    const html = await renderPage("/progress");

    expect(html).toContain("Rendered App");
  });

  it("should render page for feed route", async () => {
    const html = await renderPage("/feed");

    expect(html).toContain("Rendered App");
  });

  it("should render page for profile route", async () => {
    const html = await renderPage("/profile");

    expect(html).toContain("Rendered App");
  });

  it("should render page for settings route", async () => {
    const html = await renderPage("/settings");

    expect(html).toContain("Rendered App");
  });

  it("should handle non-prefetch routes", async () => {
    const html = await renderPage("/login");

    expect(html).toContain("Rendered App");
  });

  it("should handle routes with query strings", async () => {
    const html = await renderPage("/sessions?status=completed");

    expect(html).toContain("Rendered App");
  });

  it("should use development script in non-production", async () => {
    process.env.NODE_ENV = "development";
    const html = await renderPage("/");

    expect(html).toContain("/src/main.tsx");
  });

  it("should use fallback script when manifest missing in production", async () => {
    process.env.NODE_ENV = "production";
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockReturnValue(
      '<html><head></head><body><div id="root"></div><script type="module" src="/src/bootstrap.ts"></script></body></html>',
    );

    const html = await renderPage("/");

    expect(html).toMatch(/src="\/assets\/js\/[^"]+\.js"/);
    expect(html).not.toContain("/assets/assets/");
  });

  it("should inject hashed assets from the Vite manifest", async () => {
    process.env.NODE_ENV = "production";
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const value = String(path);
      return value.includes("manifest.json") || value.endsWith(".css");
    });
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).includes("manifest.json")) {
        return JSON.stringify({
          "src/main.tsx": {
            file: "assets/js/main-abc123.js",
            css: ["assets/css/index-def456.css"],
            isDynamicEntry: true,
          },
        });
      }
      if (String(path).endsWith(".css")) {
        return "h3{color:#fff}";
      }
      return '<html><head></head><body><div id="root"></div><script type="module" src="/src/bootstrap.ts"></script></body></html>';
    });

    const html = await renderPage("/login");

    expect(html).toMatch(/src="\/assets\/js\/[^"]+\.js"/);
    expect(html).not.toContain("/assets/assets/");
    expect(html).not.toContain("modulepreload");
    if (html.includes("<style data-href=")) {
      expect(html).not.toMatch(/rel="stylesheet" href="\/assets\/css\//);
    }
  });

  it("should handle manifest parse errors gracefully", async () => {
    process.env.NODE_ENV = "production";
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).includes("manifest.json")) {
        throw new Error("Parse error");
      }
      return '<html><head></head><body><div id="root"></div><script type="module" src="/src/bootstrap.ts"></script></body></html>';
    });

    const html = await renderPage("/");

    expect(html).toMatch(/<script type="module"/);
    expect(html).not.toContain("/assets/assets/");
  });

  it("should handle i18n initialization timeout", async () => {
    mockI18n.isInitialized = false;
    mockI18n.on.mockImplementation((event, callback) => {
      // Don't call callback - simulate timeout
      return mockI18n as any;
    });

    const html = await renderPage("/");

    expect(html).toContain("Rendered App");
    mockI18n.isInitialized = true;
  });

  it("should handle i18n language change", async () => {
    mockI18n.language = "de";

    const html = await renderPage("/");

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith("en");
    expect(html).toContain("Rendered App");
    mockI18n.language = "en";
  });

  it("schedules insight queries for insight and progress routes", async () => {
    await renderPage("/insights");
    await renderPage("/progress?period=30");

    const queryKeys = prefetchQuery.mock.calls.map(([options]) => options.queryKey);
    expect(queryKeys).toEqual(
      expect.arrayContaining([
        ["progress-trends", { period: 30, group_by: "week" }, "week"],
        ["exercise-breakdown", { period: 30 }],
      ]),
    );
    expect(prefetchQuery).toHaveBeenCalledTimes(4);
  });

  it("schedules public feed prefetch only for the feed route", async () => {
    prefetchQuery.mockClear();

    await renderPage("/feed");
    await renderPage("/profile");

    expect(prefetchQuery).toHaveBeenCalledTimes(1);
    expect(prefetchQuery.mock.calls[0]?.[0]?.queryKey).toEqual([
      "feed",
      { scope: "public", limit: 20, offset: 0 },
    ]);
  });

  it("replaces nested fallback root content without leaving nested shell markup behind", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockReturnValue(
      '<html><head></head><body><div id="root"><div><div>Old shell</div></div></div></body></html>',
    );

    const html = await renderPage("/login");

    expect(html).toContain('<div id="root"><div>Rendered App</div></div>');
    expect(html).not.toContain("Old shell");
  });

});
