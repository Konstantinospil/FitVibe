/**
 * SSR render tests
 * Tests server-side rendering functionality
 */

import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type * as NodeFs from "node:fs";
import { renderPage } from "../../src/ssr/render.js";
import * as servicesApi from "../../src/services/api.js";

// Mock dependencies
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
    prefetchQuery: vi.fn(),
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

  it("prefetches insight data for insight and progress routes", async () => {
    vi.mocked(servicesApi.getProgressTrends).mockResolvedValue({} as never);
    vi.mocked(servicesApi.getExerciseBreakdown).mockResolvedValue({} as never);

    await renderPage("/insights");
    await renderPage("/progress?period=30");

    expect(servicesApi.getProgressTrends).toHaveBeenCalledTimes(2);
    expect(servicesApi.getProgressTrends).toHaveBeenCalledWith({
      period: 30,
      group_by: "week",
    });
    expect(servicesApi.getExerciseBreakdown).toHaveBeenCalledTimes(2);
  });

  it("prefetches public feed data only for the feed route", async () => {
    vi.mocked(servicesApi.getFeed).mockResolvedValue({ data: [], total: 0 } as never);

    await renderPage("/feed");
    await renderPage("/profile");

    expect(servicesApi.getFeed).toHaveBeenCalledTimes(1);
    expect(servicesApi.getFeed).toHaveBeenCalledWith({
      scope: "public",
      limit: 20,
      offset: 0,
    });
  });

  it("selects a manifest entry by main chunk name when the source key is absent", async () => {
    process.env.NODE_ENV = "production";
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const value = String(path);
      return value.includes("manifest.json") || value.endsWith(".css");
    });
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const value = String(path);
      if (value.includes("manifest.json")) {
        return JSON.stringify({
          "entry-client": {
            name: "main",
            file: "assets/js/main-by-name.js",
            css: ["assets/css/main.css"],
          },
        });
      }
      if (value.endsWith(".css")) {
        return ".main{display:block}";
      }
      return '<html><head></head><body><div id="root"><div>fallback</div></div></body></html>';
    });

    const html = await renderPage("/login");

    expect(html).toContain('/assets/js/main-by-name.js');
    expect(html).toContain('data-href="/assets/css/main.css"');
  });

  it("falls back to the first entry chunk and traverses imported CSS once", async () => {
    process.env.NODE_ENV = "production";
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const value = String(path);
      if (value.includes("manifest.json")) {
        return JSON.stringify({
          entry: {
            isEntry: true,
            file: "assets/js/entry.js",
            css: ["assets/css/shared.css"],
            imports: ["shared"],
          },
          shared: {
            file: "assets/js/shared.js",
            css: ["assets/css/shared.css", "assets/css/imported.css"],
            imports: ["entry"],
          },
        });
      }
      if (value.endsWith(".css")) {
        return value.includes("imported.css") ? ".imported{display:grid}" : ".shared{display:flex}";
      }
      return '<html><head></head><body><div id="root"></div></body></html>';
    });

    const html = await renderPage("/login");

    expect(html).toContain('/assets/js/entry.js');
    expect((html.match(/data-href="\/assets\/css\/shared.css"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-href="/assets/css/imported.css"');
  });

  it("preserves a template without a root marker instead of corrupting it", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readFileSync).mockReturnValue(
      '<html><head></head><body><main id="static">Static shell</main></body></html>',
    );

    const html = await renderPage("/login");

    expect(html).toContain('<main id="static">Static shell</main>');
    expect(html).not.toContain('<div id="root">Rendered App</div>');
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
