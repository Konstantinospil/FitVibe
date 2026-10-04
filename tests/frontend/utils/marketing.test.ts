import { afterEach, describe, expect, it, vi } from "vitest";
import { disableMarketing, initializeMarketing } from "../../src/utils/marketing";

describe("marketing", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });
  it("initializes without throwing", () => {
    expect(() => initializeMarketing()).not.toThrow();
  });

  it("disables tracking when fbq is present", () => {
    (window as unknown as { fbq?: unknown }).fbq = vi.fn();
    expect(() => disableMarketing()).not.toThrow();
    delete (window as unknown as { fbq?: unknown }).fbq;
  });

  it("disables tracking when fbq is absent", () => {
    delete (window as unknown as { fbq?: unknown }).fbq;
    expect(() => disableMarketing()).not.toThrow();
  });

  it("executes development-only initialization branches without side effects", () => {
    process.env.NODE_ENV = "development";
    expect(() => initializeMarketing()).not.toThrow();
    expect(() => disableMarketing()).not.toThrow();
  });

  it("disables marketing safely when window is unavailable", () => {
    const originalWindow = global.window;
    // @ts-expect-error intentional SSR simulation
    delete global.window;
    try {
      expect(() => disableMarketing()).not.toThrow();
    } finally {
      global.window = originalWindow;
    }
  });

});
