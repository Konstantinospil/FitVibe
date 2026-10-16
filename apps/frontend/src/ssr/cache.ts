/**
 * HTML caching for SSR
 * Caches rendered HTML for public routes to improve performance
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { env } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");
const cacheDir = resolve(root, "dist/static");

// In-memory cache for runtime caching
const memoryCache = new Map<string, { html: string; timestamp: number }>();

// Cache TTL in milliseconds (5 minutes for public routes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Public routes that can be cached
 */
const PUBLIC_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/login/verify-2fa",
  "/verify",
  "/terms",
  "/privacy",
]);

/**
 * Checks if a route is cacheable (public route)
 */
export function isCacheableRoute(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return PUBLIC_ROUTES.has(path);
}

/**
 * Gets cached HTML from memory or disk
 */
export function getCachedHtml(url: string): string | null {
  // Check memory cache first
  const memoryEntry = memoryCache.get(url);
  if (memoryEntry) {
    const age = Date.now() - memoryEntry.timestamp;
    if (age < CACHE_TTL) {
      return memoryEntry.html;
    }
    // Expired, remove from cache
    memoryCache.delete(url);
  }

  // Check disk cache
  if (env.NODE_ENV === "production") {
    const cachePath = getCachePath(url);
    if (existsSync(cachePath)) {
      try {
        const stats = statSync(cachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_TTL) {
          // SECURITY: Handle file system race condition
          // File might be deleted between statSync and readFileSync
          // Use try-catch around readFileSync to handle this race condition atomically
          try {
            const html = readFileSync(cachePath, "utf-8");
            // Store in memory cache for faster access
            memoryCache.set(url, { html, timestamp: Date.now() });
            return html;
          } catch {
            // File was deleted or modified between statSync and readFileSync
            // This is expected in concurrent environments - ignore and return null
            // The cache will be regenerated on next request
          }
        }
      } catch {
        // Ignore errors reading cache (file might have been deleted)
      }
    }
  }

  return null;
}

/**
 * Sets cached HTML in memory and optionally on disk
 */
export function setCachedHtml(url: string, html: string): void {
  // Store in memory cache
  memoryCache.set(url, { html, timestamp: Date.now() });

  // Store on disk in production
  if (env.NODE_ENV === "production") {
    try {
      const cachePath = getCachePath(url);
      // Ensure cache directory exists
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, html, "utf-8");
    } catch (error) {
      // Log but don't fail - caching is optional
      console.warn("Failed to write cache to disk:", error);
    }
  }
}

/**
 * Gets the cache file path for a URL
 */
function getCachePath(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  const safePath = path === "/" ? "index" : path.replace(/\//g, "_").replace(/^_/, "");
  return resolve(cacheDir, `${safePath}.html`);
}

/**
 * Clears all caches (memory and disk)
 */
export function clearCache(): void {
  memoryCache.clear();
  // Disk cache will expire naturally based on TTL
}

/**
 * Pre-generates static HTML for all public routes
 * This is called at build time to create static files
 */
export async function generateStaticPages(
  renderPage: (url: string) => Promise<string>,
): Promise<void> {
  console.warn("Generating static pages for public routes...");

  for (const route of PUBLIC_ROUTES) {
    try {
      console.warn(`Generating static page: ${route}`);
      const html = await renderPage(route);
      setCachedHtml(route, html);

      console.warn(`✓ Generated: ${route}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${route}:`, error);
    }
  }

  console.warn("Static page generation complete");
}
