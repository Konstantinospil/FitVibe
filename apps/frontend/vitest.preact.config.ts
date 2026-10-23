import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Isolated Preact-compat pilot for #523.
 * The existing SSR/React Vitest configuration remains authoritative.
 */
export default defineConfig({
  root,
  plugins: [preact()],
  resolve: {
    // Pilot files live outside this workspace; resolve its runtime from the frontend package.
    alias: {
      "preact/test-utils": resolve(root, "node_modules/preact/test-utils"),
      "preact/jsx-runtime": resolve(root, "node_modules/preact/jsx-runtime"),
      "preact/jsx-dev-runtime": resolve(root, "node_modules/preact/jsx-dev-runtime"),
      "preact/compat": resolve(root, "node_modules/preact/compat"),
      preact: resolve(root, "node_modules/preact"),
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      "react/jsx-dev-runtime": "preact/jsx-dev-runtime",
      "react/jsx-runtime": "preact/jsx-runtime",
      react: "preact/compat",
      "../../src": resolve(root, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["../../tests/frontend/preact/**/*.preact.test.tsx"],
    setupFiles: ["../../tests/frontend/preact/setup.ts"],
    maxWorkers: 1,
    isolate: true,
  },
});
