import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { configDefaults } from "vitest/config";
import { resolve as pathResolve } from "node:path";

export default defineConfig(() => {
  const isVitest = process.env.VITEST === "true";
  const isSSR = process.env.SSR === "true";
  const coverageEnabled =
    process.env.VITEST_COVERAGE === "true" ||
    process.argv.includes("--coverage") ||
    process.argv.some((arg) => arg.startsWith("--coverage="));
  const root = fileURLToPath(new URL(".", import.meta.url));
  const workspaceRoot = pathResolve(root, "../..");

  // Vitest 4 removed poolOptions/maxThreads. Limit workers with maxWorkers instead.
  // Keep the old env var as a temporary compatibility fallback.
  const maxWorkers = process.env.VITEST_MAX_WORKERS
    ? parseInt(process.env.VITEST_MAX_WORKERS, 10)
    : process.env.VITEST_MAX_THREADS
      ? parseInt(process.env.VITEST_MAX_THREADS, 10)
      : 4;

  // For SSR, we need React (not Preact) since we're using react-dom/server
  // For tests, we use React
  // For client builds with SSR, we must use React for hydration to work
  // For client-only builds, we can use Preact for smaller bundle size
  // Note: When SSR is enabled, both server and client must use React
  const useReact = isVitest || isSSR || process.env.USE_REACT === "true";

  return {
    root,
    plugins: useReact ? [react()] : [preact()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        // Explicitly resolve testing libraries for setup files in tests/frontend/
        ...(isVitest
          ? {
              "react/jsx-dev-runtime": pathResolve(
                root,
                "node_modules/react/jsx-dev-runtime.js",
              ),
              "react/jsx-runtime": pathResolve(root, "node_modules/react/jsx-runtime.js"),
              "react-dom": pathResolve(root, "node_modules/react-dom"),
              react: pathResolve(root, "node_modules/react"),
              "@testing-library/jest-dom": pathResolve(
                root,
                "node_modules/@testing-library/jest-dom",
              ),
              "@testing-library/react": pathResolve(root, "node_modules/@testing-library/react"),
              "@testing-library/user-event": pathResolve(
                root,
                "node_modules/@testing-library/user-event",
              ),
              "@testing-library/dom": pathResolve(root, "node_modules/@testing-library/dom"),
              "react-router-dom": pathResolve(root, "node_modules/react-router-dom"),
              "react-router": pathResolve(root, "node_modules/react-router"),
              "@remix-run/router": pathResolve(root, "node_modules/@remix-run/router"),
              i18next: pathResolve(root, "node_modules/i18next"),
              "react-i18next": pathResolve(root, "node_modules/react-i18next"),
              "@tanstack/react-query": pathResolve(root, "node_modules/@tanstack/react-query"),
              "axios-mock-adapter": pathResolve(root, "node_modules/axios-mock-adapter"),
              // Resolve relative imports from tests/frontend/ to apps/frontend/src/
              // This allows tests in tests/frontend/ to use ../src to import from apps/frontend/src/
              "../src": pathResolve(root, "src"),
              // Also handle imports from tests/frontend subdirectories
              "../../src": pathResolve(root, "src"),
            }
          : {}),
        // For SSR, we must use React (not Preact) for react-dom/server to work
        // Only use Preact aliases for client builds when not doing SSR
        ...(isVitest || isSSR
          ? {}
          : {
              react: "preact/compat",
              "react-dom/test-utils": "preact/test-utils",
              "react-dom": "preact/compat",
              "react/jsx-runtime": "preact/jsx-runtime",
            }),
      },
      // Ensure node_modules resolution works for setup files outside the app directory
      // Include both frontend's node_modules and workspace root node_modules
      // Prioritize frontend's node_modules for test dependencies
      modules: [
        pathResolve(root, "node_modules"),
        pathResolve(workspaceRoot, "node_modules"),
        "node_modules",
      ],
      preserveSymlinks: false,
      // Ensure proper resolution of dependencies when tests are in tests/frontend
      dedupe: ["@testing-library/react", "@testing-library/jest-dom", "axios-mock-adapter"],
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "../../tests/frontend/setupTests.ts",
      include: ["../../tests/frontend/**/*.test.{ts,tsx}"],
      exclude: [
        "../../tests/frontend/**/*.spec.{ts,tsx}",
        "../../tests/frontend/visual/**",
        "../../tests/frontend/e2e/**",
        "archive/**",
      ],
      css: true,
      // Vitest 4 defaults to forks; use it explicitly because it is more robust
      // for jsdom-heavy suites on Windows than the old threads pool.
      pool: "forks",
      maxWorkers,
      isolate: true,
      // Enable test-level parallelization within files (use with caution if tests share state)
      sequence: {
        shuffle: false,
        concurrent: false, // Disabled to prevent DOM pollution from concurrent tests
      },
      testTimeout: 30000, // 30 second timeout per test (increased to catch slow tests)
      hookTimeout: 15000, // 15 second timeout for hooks (increased for i18n loading)
      teardownTimeout: 15000, // 15 second timeout for teardown (increased for cleanup)
      // Prevent tests from hanging by detecting open handles
      detectOpenHandles: true,
      // Force-exit skips Istanbul reporters and leaves only coverage/.tmp,
      // which GitHub's upload-artifact ignores (hidden files). Keep it off
      // whenever coverage is collected; CI job timeouts still bound hangs.
      forceExit: !coverageEnabled,
      forceRerunTriggers: ["**/src/**", "**/tests/**"],
      // Ensure dependencies are resolved correctly for setup files
      // Inline all test dependencies to ensure they're resolved from the correct node_modules
      server: {
        deps: {
          inline: [
            // Explicit package names first
            "@testing-library/jest-dom",
            "@testing-library/react",
            "@testing-library/user-event",
            "@testing-library/dom",
            "react-router-dom",
            "react-router",
            "@remix-run/router",
            "i18next",
            "react-i18next",
            "@tanstack/react-query",
            "axios-mock-adapter",
            "axios",
            "recharts",
            // Regex patterns to catch all sub-packages
            /^@testing-library\//,
            /^vitest\//,
            /^react-router/,
            /^@remix-run\//,
            /^@tanstack\//,
          ],
        },
      },
      coverage: {
        ...(coverageEnabled ? { enabled: true as const } : {}),
        provider: "istanbul" as const,
        reporter: ["text", "html", "json", "json-summary", "lcov"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          ...(configDefaults.coverage.exclude || []),
          "src/main.tsx",
          "archive/**",
          "src/components/admin/AdminStats.tsx",
        ],
        reportsDirectory: pathResolve(root, "coverage"),
        tempDirectory: pathResolve(root, "coverage", ".tmp"),
        clean: true,
        cleanOnRerun: true,
        reportOnFailure: true,
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:4000",
      },
    },
    preview: {
      // Allow Docker/CI hosts to hit `vite preview` (Vite 6 blocks unknown Host headers).
      allowedHosts: true,
    },
    build: {
      // Optimize build for performance
      minify: "esbuild" as const,
      target: "es2020",
      cssMinify: true,
      sourcemap: false,
      // SSR builds output to dist/server, client builds to dist/client
      outDir: isSSR ? "dist/server" : "dist/client",
      manifest: !isSSR,
      // Reduce bundle size by optimizing module resolution
      modulePreload: {
        polyfill: false, // Disable module preload polyfill to reduce size
      },
      // Improve performance with better chunk size limits
      chunkSizeWarningLimit: 250, // Reduce warning threshold to catch large chunks earlier
      // Improve loading performance with better chunking strategy
      rollupOptions: {
        output: {
          // Optimize chunk splitting for better caching and loading
          // Let Rollup derive dependency chunks from the actual module graph.
          // Manually forcing interdependent runtime packages into named vendor
          // chunks caused circular initialization order failures in production.
          // Optimize chunk file names for better caching
          // For SSR, output to server directory structure
          chunkFileNames: isSSR ? "[name]-[hash].js" : "assets/js/[name]-[hash].js",
          entryFileNames: isSSR ? "[name]-[hash].js" : "assets/js/[name]-[hash].js",
          assetFileNames: isSSR
            ? "assets/[ext]/[name]-[hash].[ext]"
            : "assets/[ext]/[name]-[hash].[ext]",
        },
      },
      // Enable tree shaking with more aggressive settings
      treeshake: {
        moduleSideEffects: (id: string) => {
          // Preserve third-party package side effects. Some dependencies perform
          // runtime feature detection and adapter setup during module evaluation.
          if (id.includes("node_modules")) {
            return true;
          }
          // CSS and JSON imports are also intentionally side-effectful.
          if (id.includes(".css") || id.includes(".json")) {
            return true;
          }
          return false;
        },
        preset: "recommended",
        // Keep Rollup's safe defaults for property reads and try/catch blocks.
        // Over-aggressive deoptimization settings broke Axios in the production bundle.
        propertyReadSideEffects: true,
        tryCatchDeoptimization: true,
      },
      // Enable compression reporting for monitoring
      reportCompressedSize: true,
      // Optimize asset inlining threshold - inline more small assets to reduce requests
      assetsInlineLimit: 16384, // Inline assets smaller than 16KB to reduce HTTP requests
      // Enable CSS code splitting to load only necessary CSS per route, improving LCP
      cssCodeSplit: true,
      // Optimize for faster initial load by reducing initial bundle size
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      // Reduce initial bundle size by using dynamic imports for non-critical code
      // This helps with code splitting and lazy loading
      experimental: {
        renderBuiltUrl(_filename: string) {
          // Use relative URLs for better caching
          return { relative: true };
        },
      },
    },
    // SSR configuration
    ssr: {
      // Don't externalize these packages for SSR - bundle them
      // These are needed for SSR rendering
      noExternal: [
        "react",
        "react-dom",
        "react-router-dom",
        "react-router",
        "@tanstack/react-query",
        "react-i18next",
        "i18next",
        "zustand",
        // Internal modules should be bundled
        /^@fitvibe\//,
      ],
      // Externalize large dependencies that don't need to be in the SSR bundle
      // These will be resolved from node_modules at runtime
      external: [
        // Express is provided by the server runtime
        "express",
        // Node.js built-ins
        "node:fs",
        "node:path",
        "node:url",
        "node:stream",
      ],
      // Optimize SSR bundle output
      resolve: {
        // Don't bundle dev dependencies for SSR
        conditions: ["node", "production"],
      },
    },
  };
});
