/**
 * Express server for Server-Side Rendering (SSR)
 * Serves the React app with server-side rendering
 */

import "./scripts/register-static-assets.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { isCacheableRoute, getCachedHtml, setCachedHtml } from "./src/ssr/cache.js";
import { loadProductionRenderPage } from "./src/ssr/loadRenderPage.js";
import { recordSSRMetric } from "./src/ssr/metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, ".");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4173;
const isProduction = process.env.NODE_ENV === "production";

const nonHtmlContentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const sha256Source = (value: string) =>
  `'sha256-${createHash("sha256").update(value, "utf8").digest("base64")}'`;

const contentSecurityPolicyForHtml = (html: string) => {
  const styleHashes = [
    ...new Set(
      Array.from(html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi), (match) =>
        sha256Source(match[1] ?? ""),
      ),
    ),
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    `style-src 'self'${styleHashes.length ? ` ${styleHashes.join(" ")}` : ""}`,
    "style-src-attr 'unsafe-inline'",
  ].join("; ");
};

const setHtmlContentSecurityPolicy = (res: Response, html: string) => {
  res.setHeader("Content-Security-Policy", contentSecurityPolicyForHtml(html));
};

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", nonHtmlContentSecurityPolicy);
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

// Enable compression for all responses (gzip/brotli)
// This improves Lighthouse "uses-text-compression" score
app.use(
  compression({
    filter: (req: Request, res: Response) => {
      // Compress all text-based responses
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses > 1KB
  }),
);

// Import SSR renderer - use built bundle in production, source in development
// We'll import this dynamically in the route handler to avoid top-level await issues
let renderPageCache: ((url: string) => Promise<string>) | null = null;

const getRenderPage = async (): Promise<(url: string) => Promise<string>> => {
  if (renderPageCache) {
    return renderPageCache;
  }

  if (isProduction) {
    try {
      renderPageCache = await loadProductionRenderPage(root);
      return renderPageCache;
    } catch (error) {
      console.error("Failed to load production render bundle:", error);
      // Fallback to source if built file not found
      const module = await import("./src/ssr/render.js");
      if (typeof module.renderPage === "function") {
        renderPageCache = module.renderPage as (url: string) => Promise<string>;
        return renderPageCache;
      }
      throw new Error("renderPage is not a function in fallback module");
    }
  } else {
    const module = await import("./src/ssr/render.js");
    if (typeof module.renderPage === "function") {
      renderPageCache = module.renderPage as (url: string) => Promise<string>;
      return renderPageCache;
    }
    throw new Error("renderPage is not a function in development module");
  }
};

// Health check endpoint for container orchestration (must be before SSR handler)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "frontend-ssr" });
});

// Metrics endpoint for monitoring (must be before SSR handler)
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const metricsHandler: RequestHandler = async (_req: Request, res: Response) => {
  try {
    const { getSSRStats } = await import("./src/ssr/metrics.js");
    const stats = getSSRStats();
    res.status(200).json({
      service: "frontend-ssr",
      metrics: stats,
    });
  } catch {
    res.status(500).json({ error: "Failed to get metrics" });
  }
};
app.get("/metrics", metricsHandler);

// Serve static assets with performance headers
// Long cache TTL for immutable assets (improves Lighthouse "uses-long-cache-ttl" score)
const staticOptions = {
  maxAge: isProduction ? 31536000000 : 0, // 1 year in production, no cache in dev
  etag: true,
  lastModified: true,
  immutable: isProduction,
  setHeaders: (res: Response, path: string) => {
    // Set aggressive cache headers for static assets
    if (isProduction) {
      // Cache static assets for 1 year (immutable with hash in filename)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
};

if (isProduction) {
  // In production, serve from dist/client
  app.use("/assets", express.static(resolve(root, "dist/client/assets"), staticOptions));
  app.use("/fonts", express.static(resolve(root, "dist/client/fonts"), staticOptions));
  app.use("/favicon.ico", express.static(resolve(root, "dist/client/favicon.ico"), staticOptions));
} else {
  // In development, serve from public
  app.use("/assets", express.static(resolve(root, "public")));
  app.use("/fonts", express.static(resolve(root, "public/fonts")));
  app.use("/favicon.ico", express.static(resolve(root, "public/favicon.ico")));
}

const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
};

app.all("/api", notFound);
app.all("/api/{*splat}", notFound);
app.all("/admin", notFound);
app.all("/admin/{*splat}", notFound);
app.get("/sitemap.xml", (_req: Request, res: Response) => {
  res.status(404).type("text/plain").send("Not Found");
});

// Serve robots.txt with proper headers
app.get("/robots.txt", (_req: Request, res: Response) => {
  const robotsPath = isProduction
    ? resolve(root, "dist/client/robots.txt")
    : resolve(root, "public/robots.txt");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
  res.sendFile(robotsPath, (err) => {
    if (err) {
      // Fallback robots.txt if file doesn't exist
      res.status(200).send("User-agent: *\nAllow: /\nDisallow: /api/\n");
    }
  });
});

// SSR route handler with caching and metrics
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const ssrHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  let error: string | undefined;

  try {
    // Check cache for public routes
    if (isCacheableRoute(req.url)) {
      const cachedHtml = getCachedHtml(req.url);
      if (cachedHtml) {
        const renderTime = Date.now() - startTime;
        recordSSRMetric({
          renderTime,
          url: req.url,
          timestamp: Date.now(),
          cacheHit: true,
        });
        // Performance headers
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-SSR-Time", `${renderTime}ms`);
        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600"); // 5 min browser, 10 min CDN
        setHtmlContentSecurityPolicy(res, cachedHtml);
        return res.send(cachedHtml);
      }
    }

    // Render page
    const renderPage = await getRenderPage();
    const html = await renderPage(req.url);

    // Cache public routes
    if (isCacheableRoute(req.url)) {
      setCachedHtml(req.url, html);
      res.setHeader("X-Cache", "MISS");
    }

    const renderTime = Date.now() - startTime;
    recordSSRMetric({
      renderTime,
      url: req.url,
      timestamp: Date.now(),
      cacheHit: false,
    });

    // Performance headers
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-SSR-Time", `${renderTime}ms`);
    // Add cache control for public routes
    if (isCacheableRoute(req.url)) {
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600"); // 5 min browser, 10 min CDN
    } else {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    setHtmlContentSecurityPolicy(res, html);
    res.send(html);
  } catch (err) {
    const renderTime = Date.now() - startTime;
    error = err instanceof Error ? err.message : String(err);

    // Sanitize URL and error to prevent log injection
    const sanitizedUrl = String(req.url || "")
      .replace(/[\r\n]/g, "")
      .substring(0, 500);
    const sanitizedError = String(error || "")
      .replace(/[\r\n]/g, "")
      .substring(0, 1000);

    recordSSRMetric({
      renderTime,
      url: sanitizedUrl,
      timestamp: Date.now(),
      cacheHit: false,
      error: sanitizedError,
    });

    console.error("SSR Error for URL:", sanitizedUrl);
    console.error("Error details:", sanitizedError);
    if (err instanceof Error && err.stack) {
      console.error("Stack trace:", err.stack);
    }
    next(err);
  }
};
// Express 5 / path-to-regexp v8 requires a named splat; /{*splat} matches `/` and nested paths.
app.get("/{*splat}", ssrHandler);

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("Server Error:", err);
  res.status(500).send("Internal Server Error");
});

// Start server
app.listen(PORT, () => {
  console.warn(`SSR server running on http://localhost:${PORT}`);
});
