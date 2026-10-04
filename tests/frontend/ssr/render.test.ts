/**
 * SSR rendering tests
 * Tests server-side rendering functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as NodeFs from "node:fs";
import { renderPage } from "../../src/ssr/render.js";

// Mock the dependencies
vi.mock("react-dom/server", () => ({
  renderToString: vi.fn((component) => "<div>Rendered</div>"),
}));

vi.mock("../../src/lib/queryClient.js", () => ({
  createQueryClient: vi.fn(() => {
    const mockQueryClient = {
      prefetchQuery: vi.fn(() => Promise.resolve()),
      getDefaultOptions: vi.fn(() => ({})),
      getQueryCache: vi.fn(() => ({
        getAll: vi.fn(() => []),
      })),
      getMutationCache: vi.fn(() => ({
        getAll: vi.fn(() => []),
      })),
    };
    return mockQueryClient;
  }),
}));

// Mock react-router-dom/server before Router to prevent dependency resolution issues
vi.mock("react-router-dom/server", () => ({
  createStaticHandler: vi.fn(),
}));

vi.mock("../../src/routes/Router.js", () => ({
  Router: vi.fn(({ children }) => children),
}));

vi.mock("../../src/contexts/ToastContext.js", () => ({
  ToastProvider: vi.fn(({ children }) => children),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof NodeFs;
  return {
    ...actual,
    readFileSync: vi.fn(
      () => '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    ),
    existsSync: vi.fn(() => false),
  };
});

describe("SSR render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render a page for a given URL", async () => {
    const html = await renderPage("/login");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<div id="root">');
  });

  it("should inject dehydrated state as inert markup", async () => {
    const html = await renderPage("/login");
    expect(html).toContain('id="fitvibe-react-query-state"');
    expect(html).not.toContain("window.__REACT_QUERY_STATE__");
  });

  it("should inject hydration script", async () => {
    const html = await renderPage("/login");
    expect(html).toContain('<script type="module"');
  });

  it("should handle different routes", async () => {
    const routes = ["/", "/login", "/register", "/terms", "/privacy"];
    for (const route of routes) {
      const html = await renderPage(route);
      expect(html).toContain("<!doctype html>");
    }
  });
});
