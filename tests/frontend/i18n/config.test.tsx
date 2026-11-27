import { describe, it, expect, beforeEach } from "vitest";
import i18n, {
  ensurePrivateTranslationsLoaded,
  loadFullTranslations,
  loadLanguageTranslations,
  ensureLegalTranslationsLoaded,
} from "../../src/i18n/config";

describe("i18n config", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads English JSON bundles into the translation namespace", async () => {
    await loadFullTranslations();

    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.t("navigation.back")).toBe("Back");
    expect(i18n.t("gamification.badges.title")).toBe("Badges");
    expect(i18n.t("feed.follow.follow")).toBe("Follow");
  });

  it("loads another language from locale JSON files", async () => {
    await loadLanguageTranslations("de");

    expect(i18n.hasResourceBundle("de", "translation")).toBe(true);
    expect(i18n.getResource("de", "translation", "navigation.back")).toBe("Zurück");
  });

  it("ensurePrivateTranslationsLoaded resolves", async () => {
    await expect(ensurePrivateTranslationsLoaded()).resolves.toBeUndefined();
  });

  it("nests terms and privacy JSON so list keys return arrays", async () => {
    await loadFullTranslations();
    await i18n.changeLanguage("en");
    await ensureLegalTranslationsLoaded();
    // Once a legal page has needed them, switching language brings them along.
    await loadLanguageTranslations("el");

    const englishTerms = i18n.t("terms.section1.items", { lng: "en", returnObjects: true });
    const greekTerms = i18n.t("terms.section1.items", { lng: "el", returnObjects: true });
    const greekPrivacy = i18n.t("privacy.section1.items", { lng: "el", returnObjects: true });

    expect(Array.isArray(englishTerms)).toBe(true);
    expect(Array.isArray(greekTerms)).toBe(true);
    expect(Array.isArray(greekPrivacy)).toBe(true);
    expect((greekTerms as string[]).length).toBeGreaterThan(0);
  });
});
