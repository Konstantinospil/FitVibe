import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL(".", import.meta.url));
const requireFromFrontend = createRequire(resolve(root, "package.json"));

/**
 * Isolated Preact-compat pilot for #523.
 * The existing SSR/React Vitest configuration remains authoritative.
 */
export default defineConfig({
  root,
  plugins: [preact()],
  resolve: {
    // Exact-match aliases avoid the "preact" prefix rewriting subpath imports.
    // Resolve exports from the frontend package rather than tests/frontend/.
    alias: [
      ...["preact/jsx-dev-runtime", "preact/jsx-runtime", "preact/test-utils", "preact/compat", "preact"].map((id) => ({
        find: new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        replacement: requireFromFrontend.resolve(id),
      })),
      { find: "react-dom/test-utils", replacement: requireFromFrontend.resolve("preact/test-utils") },
      { find: "react-dom", replacement: requireFromFrontend.resolve("preact/compat") },
      { find: "react/jsx-dev-runtime", replacement: requireFromFrontend.resolve("preact/jsx-dev-runtime") },
      { find: "react/jsx-runtime", replacement: requireFromFrontend.resolve("preact/jsx-runtime") },
      { find: "react", replacement: requireFromFrontend.resolve("preact/compat") },
      { find: "../../src", replacement: resolve(root, "src") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["../../tests/frontend/preact/**/*.preact.test.tsx"],
    setupFiles: ["../../tests/frontend/preact/setup.ts"],
    maxWorkers: 1,
    isolate: true,
  },
});
