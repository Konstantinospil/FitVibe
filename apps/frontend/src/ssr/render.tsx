/**
 * Server-Side Rendering (SSR) renderer
 * Renders React components to HTML string for SSR
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClientProvider, dehydrate, type QueryClient } from "@tanstack/react-query";
import { Router } from "../routes/Router.js";
import { ToastProvider } from "../contexts/ToastContext.js";
import { createQueryClient } from "../lib/queryClient.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { styleTagsFor } from "./inlineStyles.js";
import { DEHYDRATED_STATE_ELEMENT_ID, serializeDehydratedState } from "./dehydratedState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __dirname is apps/frontend/src/ssr, so go up to apps/frontend
const root = resolve(__dirname, "../..");

/**
 * Reads the HTML template file
 */
function getHtmlTemplate(): string {
  const templatePath = resolve(root, "index.html");
  return readFileSync(templatePath, "utf-8");
}

function replaceRootContent(template: string, appHtml: string): string {
  const rootOpen = '<div id="root">';
  const rootStart = template.indexOf(rootOpen);
  if (rootStart === -1) {
    return template;
  }

  const contentStart = rootStart + rootOpen.length;
  let depth = 1;
  let cursor = contentStart;

  while (cursor < template.length && depth > 0) {
    const nextOpen = template.indexOf("<div", cursor);
    const nextClose = template.indexOf("</div>", cursor);
    if (nextClose === -1) {
      break;
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return `${template.slice(0, rootStart)}<div id="root">${appHtml}</div>${template.slice(nextClose + 6)}`;
    }
    cursor = nextClose + 6;
  }

  return template.replace(rootOpen, `<div id="root">${appHtml}`);
}

/**
 * Prefetches data for a given route
 * This function determines what queries need to be prefetched based on the URL
 */
async function prefetchRouteData(queryClient: QueryClient, url: string): Promise<void> {
  // Parse the URL to determine the route
  const path = url.split("?")[0]; // Remove query string
  const normalizedPath = path.toLowerCase();

  try {
    // Only prefetch for authenticated routes (protected routes)
    // Public routes (login, register, etc.) don't need data prefetching
    if (
      normalizedPath.startsWith("/sessions") ||
      normalizedPath.startsWith("/planner") ||
      normalizedPath.startsWith("/insights") ||
      normalizedPath.startsWith("/progress") ||
      normalizedPath.startsWith("/feed") ||
      normalizedPath.startsWith("/profile") ||
      normalizedPath.startsWith("/settings")
    ) {
      // Dynamically import API functions to avoid loading them on server if not needed
      const { getProgressTrends, getExerciseBreakdown, getFeed } =
        await import("../services/api.js");

      // Prefetch data for insights page
      if (normalizedPath === "/insights" || normalizedPath === "/progress") {
        await Promise.allSettled([
          queryClient.prefetchQuery({
            queryKey: ["progress-trends", { period: 30, group_by: "week" }, "week"],
            queryFn: () =>
              getProgressTrends({
                period: 30,
                group_by: "week",
              }),
          }),
          queryClient.prefetchQuery({
            queryKey: ["exercise-breakdown", { period: 30 }],
            queryFn: () =>
              getExerciseBreakdown({
                period: 30,
              }),
          }),
        ]);
      }

      // Prefetch data for feed page
      if (normalizedPath === "/feed") {
        await queryClient.prefetchQuery({
          queryKey: ["feed", { scope: "public", limit: 20, offset: 0 }],
          queryFn: () => getFeed({ scope: "public", limit: 20, offset: 0 }),
        });
      }
    }
  } catch (error) {
    // Log error but don't fail SSR - let client-side handle data fetching
    // Only log in development to avoid console errors in production
    if (process.env.NODE_ENV !== "production") {
      console.error("Error prefetching route data:", error);
    }
  }
}

type ManifestChunk = {
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  file?: string;
  name?: string;
  css?: string[];
  imports?: string[];
};

type ClientAssets = {
  scripts: string[];
  styles: string[];
};

const DEV_ASSETS: ClientAssets = { scripts: ["/src/main.tsx"], styles: [] };
const FALLBACK_ASSETS: ClientAssets = { scripts: ["/assets/js/main.js"], styles: [] };

function toPublicPath(file: string): string {
  return file.startsWith("/") ? file : `/${file}`;
}

function findMainChunk(manifest: Record<string, ManifestChunk>): ManifestChunk | undefined {
  const entries = Object.entries(manifest);
  const mainFromSource = entries.find(([key]) => key.replace(/\\/g, "/").endsWith("src/main.tsx"));
  if (mainFromSource?.[1]?.file) {
    return mainFromSource[1];
  }
  const mainByName = entries.find(
    ([, chunk]) => chunk.name === "main" && Boolean(chunk.file?.endsWith(".js")),
  );
  if (mainByName?.[1]?.file) {
    return mainByName[1];
  }
  return entries.find(([, chunk]) => chunk.isEntry && Boolean(chunk.file))?.[1];
}

/**
 * Reads Vite manifest.json to get hashed JS/CSS paths for hydration.
 */
function getClientAssets(): ClientAssets {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return DEV_ASSETS;
  }

  const manifestPath = resolve(root, "dist/client/.vite/manifest.json");
  if (!existsSync(manifestPath)) {
    return FALLBACK_ASSETS;
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<
      string,
      ManifestChunk
    >;
    const mainChunk = findMainChunk(manifest);
    if (!mainChunk?.file) {
      return FALLBACK_ASSETS;
    }

    const styles: string[] = [];
    const seen = new Set<string>();
    const visit = (chunk: ManifestChunk | undefined) => {
      if (!chunk?.file || seen.has(chunk.file)) {
        return;
      }
      seen.add(chunk.file);
      if (chunk.css?.length) {
        styles.push(...chunk.css);
      }
      for (const imported of chunk.imports ?? []) {
        visit(manifest[imported]);
      }
    };
    visit(mainChunk);

    return {
      scripts: [toPublicPath(mainChunk.file)],
      styles: [...new Set(styles.map(toPublicPath))],
    };
  } catch {
    return FALLBACK_ASSETS;
  }
}

/**
 * Renders the React app to HTML string for SSR (non-streaming fallback)
 * @param url - The URL path to render
 * @returns Complete HTML string with rendered React app
 */
export async function renderPage(url: string): Promise<string> {
  // Ensure i18n is initialized and resources are loaded before rendering
  // This is critical for SSR - components using useTranslation need i18n to be ready
  const { default: i18n, minimalTranslationsReady } = await import("../i18n/config.js");

  await Promise.race([
    minimalTranslationsReady ?? Promise.resolve(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    }),
  ]);

  // Ensure i18n language is set
  if (i18n.language !== "en") {
    await i18n.changeLanguage("en");
  }

  // Create a new QueryClient for this request (SSR best practice)
  const queryClient = createQueryClient();

  // Prefetch data for the route before rendering
  await prefetchRouteData(queryClient, url);

  // Dehydrate the query state to pass to client
  const dehydratedState = dehydrate(queryClient);

  // Render React app to string with SSR Router
  // Wrap Router in QueryClientProvider and ToastProvider
  // Pass dehydratedState to Router so it can hydrate ProtectedRoutes
  // Note: I18nextProvider removed - causing React null issues
  // i18n is initialized globally and should work without provider during SSR
  const appHtml = renderToString(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Router location={url} queryClient={queryClient} dehydratedState={dehydratedState} />
      </ToastProvider>
    </QueryClientProvider>,
  );

  // Get HTML template
  const template = getHtmlTemplate();

  // Replace the entire root div content with server-rendered app
  // Remove the static login shell and replace with SSR content
  let html = replaceRootContent(template, appHtml);

  // Remove the bootstrap script (not needed for SSR - we hydrate directly)
  html = html.replace(/<script type="module" src="\/src\/bootstrap\.ts"><\/script>/g, "");

  // Serialize dehydrated React Query state into an inert template element.
  // The client reads textContent and parses JSON, so no server-derived data is executable.
  const dehydratedStateMarkup = `<template id="${DEHYDRATED_STATE_ELEMENT_ID}">${serializeDehydratedState(dehydratedState)}</template>`;

  const isProduction = process.env.NODE_ENV === "production";
  const { scripts, styles } = getClientAssets();
  // Do not modulepreload JS in <head> — that contends with first paint on Slow 4G.
  const hydrationScript = scripts
    .map((src) => `<script type="module" src="${src}" fetchpriority="low"></script>`)
    .join("");
  const styleTags = styleTagsFor(styles, resolve(root, "dist/client"));

  const resourceHints = isProduction ? `\n    ${styleTags}\n  ` : styleTags;

  // Add Open Graph and Twitter Card meta tags for better SEO
  // These improve Lighthouse SEO score and social sharing
  const baseUrl = process.env.APP_URL || "https://fitvibe.app";
  const ogMetaTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}${url}" />
    <meta property="og:title" content="FitVibe - Plan, Log & Share Your Training" />
    <meta property="og:description" content="Plan, log, and share your training sessions. Track progress across six elemental vibes: Strength, Agility, Endurance, Explosivity, Intelligence, and Regeneration." />
    <meta property="og:image" content="${baseUrl}/favicon.ico" />
    <meta property="og:site_name" content="FitVibe" />
    <meta property="og:locale" content="en_US" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${baseUrl}${url}" />
    <meta name="twitter:title" content="FitVibe - Plan, Log & Share Your Training" />
    <meta name="twitter:description" content="Plan, log, and share your training sessions. Track progress across six elemental vibes: Strength, Agility, Endurance, Explosivity, Intelligence, and Regeneration." />
    <meta name="twitter:image" content="${baseUrl}/favicon.ico" />
    
    <!-- Additional SEO meta tags -->
    <!-- architecture-token: data-value -- Browser theme-color metadata requires a concrete color and cannot consume a CSS custom property. -->
    <meta name="theme-color" content="#0B0C10" />
    <link rel="canonical" href="${baseUrl}${url}" />
  `;

  // Inject resource hints and SEO meta tags in head
  html = html.replace("</head>", `${resourceHints}${ogMetaTags}</head>`);
  html = html.replace("</body>", `${dehydratedStateMarkup}${hydrationScript}</body>`);

  return html;
}
