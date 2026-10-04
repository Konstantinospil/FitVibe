import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import jestPlugin from "eslint-plugin-jest";
import testingLibrary from "eslint-plugin-testing-library";
import globals from "globals";

const tsconfigRoot = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "**/dist/**",
      "build/**",
      "coverage/**",
      ".turbo/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "apps/frontend/archive/**",
      "tests/**/*.cjs", // E2E test configs
      "tests/setup/test-helpers.ts", // Test helper file not in tsconfig
      "tests/setup/jest.setup.ts", // Test setup file not in tsconfig
      "tests/qa/test-manager-spec.test.ts", // Test spec file not in tsconfig
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Apply type-checked rules only to non-test files
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    ignores: [
      ...(Array.isArray(config.ignores) ? config.ignores : config.ignores ? [config.ignores] : []),
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "tests/**",
    ],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "tests/**",
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: {
        // Use projectService for monorepo support - it's more efficient than parsing multiple tsconfigs
        // Optimize by limiting scope and using caching
        projectService: {
          allowDefaultProject: ["*.js", "*.cjs", "*.mjs"],
          // Limit to specific tsconfig files for better performance
          defaultProject: "./tsconfig.json",
        },
        tsconfigRootDir: tsconfigRoot,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
      prettier,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      // Newer type declarations can flag assertions that remain necessary for safe narrowing.
      // The no-unsafe rules continue to enforce the underlying type boundary.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "prettier/prettier": [
        "error",
        {},
        {
          usePrettierrc: true,
        },
      ],
    },
  },
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["apps/backend/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "react/*": "off",
      "jsx-a11y/*": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["packages/utils/src/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Test files config - must come after main config to override rules
  {
    files: [
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "tests/**/*.ts",
      "tests/**/*.tsx",
    ],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      parserOptions: {
        // Disable type-aware linting for test files
        project: false,
      },
    },
    rules: {
      "jest/expect-expect": ["error", { assertFunctionNames: ["expect", "request", "waitFor"] }],
      "jest/no-disabled-tests": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "IfStatement[test.type='UnaryExpression'][test.operator='!'][test.argument.name='dbAvailable'][consequent.type='ReturnStatement']",
          message:
            "Do not silently return when the test database is down. Use describeWithTestDatabase.",
        },
        {
          selector:
            "IfStatement[test.type='UnaryExpression'][test.operator='!'][test.argument.name='dbAvailable'][consequent.type='BlockStatement'][consequent.body.length=1][consequent.body.0.type='ReturnStatement']",
          message:
            "Do not silently return when the test database is down. Use describeWithTestDatabase.",
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/unbound-method": "off",
      // Disable type-checking rules that require project references
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      // Disable all type-aware rules that might be in recommendedTypeChecked
      "@typescript-eslint/no-array-delete": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-useless-empty-export": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/prefer-reduce-type-parameter": "off",
      "@typescript-eslint/prefer-return-this-type": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unified-signatures": "off",
    },
  },
  {
    files: ["**/*.test.tsx", "tests/frontend/**/*.tsx"],
    plugins: {
      "testing-library": testingLibrary,
    },
    rules: {
      "testing-library/prefer-presence-queries": "error",
      "testing-library/prefer-query-by-disappearance": "error",
      "testing-library/no-await-sync-queries": "error",
      "testing-library/no-wait-for-side-effects": "off",
      "testing-library/no-node-access": "off",
      "testing-library/render-result-naming-convention": "off",
    },
  },
);
