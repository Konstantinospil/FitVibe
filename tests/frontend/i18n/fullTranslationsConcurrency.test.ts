import { beforeEach, describe, expect, it, vi } from "vitest";

// #634: main.tsx starts the full bundle early and ProtectedRoutes awaits it
// later. Both must share one download and one registration.
describe("loadFullTranslations concurrency", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const config = await import("../../src/i18n/config");
    const first = config.loadFullTranslations();
    // A second caller during the download receives the same promise.
    expect(config.loadFullTranslations()).toBe(first);
    const viaEnsure = config.ensurePrivateTranslationsLoaded();

    await Promise.all([first, viaEnsure]);

    const terms = config.default.getResource("en", "translation", "terms") as
      Record<string, unknown> | undefined;
    expect(terms && "section1" in terms).toBe(true);
  });

  it("registers the full bundle even when started before the login strings finish", async () => {
    const config = await import("../../src/i18n/config");
    const early = config.ensurePrivateTranslationsLoaded();

    await Promise.all([early, config.minimalTranslationsReady]);

    // Full common strings beyond the minimal login subset must be present.
    const fullKeys = Object.keys(
      (await import("../../src/i18n/locales/en/common.json")).default as Record<string, unknown>,
    );
    const minimalKeys = Object.keys(
      (await import("../../src/i18n/locales/en/minimal-login-common.json")).default as Record<
        string,
        unknown
      >,
    );
    const fullOnly = fullKeys.find((key) => !minimalKeys.includes(key));
    expect(fullOnly).toBeDefined();
    expect(config.default.getResource("en", "translation", fullOnly!)).toBeDefined();
  });
});
