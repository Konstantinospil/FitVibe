import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "preact/test-utils";

// Do not use the React Testing Library cleanup from the SSR test suite.
afterEach(() => {
  cleanup();
});
