const baseConfig = require("../../jest.config.cjs");

module.exports = {
  ...baseConfig,
  displayName: "backend",
  rootDir: __dirname,
  roots: ["<rootDir>/../../tests/backend"],
  testMatch: ["**/*.(spec|test).ts", "**/?(*.)+(spec|test).ts"],
  setupFiles: ["<rootDir>/jest.setup.mock.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        isolatedModules: true,
      },
    ],
  },
  coverageProvider: "v8",
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // Map uuid to use CommonJS entry point if available
    "^uuid$": require.resolve("uuid"),
  },
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.d.ts",
    "!<rootDir>/src/**/*.types.ts",
    "!<rootDir>/src/config/logger.ts",
    "!<rootDir>/src/db/migrations/**/*",
    "!<rootDir>/src/db/scripts/**/*",
    "!<rootDir>/src/**/__tests__/**/*",
    "!<rootDir>/src/jobs/services/bullmq.queue.service.ts",
    "!<rootDir>/src/jobs/services/queue.service.ts",
    "!<rootDir>/src/modules/auth/two-factor.controller.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/config/logger.ts",
    "<rootDir>/src/db/migrations",
    "<rootDir>/src/db/scripts",
    "__tests__",
    "bullmq.queue.service.ts",
    "queue.service.ts",
    "two-factor.controller.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "\\.integration\\.test\\.ts$",
    "test-manager-spec",
  ],
  clearMocks: true,
};
