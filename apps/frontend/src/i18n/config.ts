import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// Load minimal English translations for login page only
// This reduces initial bundle size significantly
export const loadMinimalLoginTranslations = async () => {
  // Only load auth.json for login page - other translations loaded on-demand
  const enAuthModule = await import("./locales/en/auth.json");
  const enCookieModule = await import("./locales/en/cookie.json");
  const enAuth = enAuthModule.default as Record<string, unknown>;

  const minimalCommonModule = await import("./locales/en/minimal-login-common.json");
  const minimalCommon = minimalCommonModule.default;

  return mergeTranslations(mergeTranslations(minimalCommon, enAuth), {
    cookie: enCookieModule.default,
  });
};

// Load full English translations (for other pages)
const loadFullEnglishTranslations = async () => {
  const [enCommonModule, enAuthModule, enTermsModule, enPrivacyModule, enCookieModule] =
    await Promise.all([
      import("./locales/en/common.json"),
      import("./locales/en/auth.json"),
      import("./locales/en/terms.json"),
      import("./locales/en/privacy.json"),
      import("./locales/en/cookie.json"),
    ]);

  const enCommon = enCommonModule.default as Record<string, unknown>;
  const enAuth = enAuthModule.default as Record<string, unknown>;
  const enTerms = enTermsModule.default as Record<string, unknown>;
  const enPrivacy = enPrivacyModule.default as Record<string, unknown>;
  const enCookie = enCookieModule.default as Record<string, unknown>;

  return mergeTranslations(
    mergeTranslations(mergeTranslations(mergeTranslations(enCommon, enAuth), { terms: enTerms }), {
      privacy: enPrivacy,
    }),
    { cookie: enCookie },
  );
};

type SupportedLanguage = "en" | "de" | "fr" | "es" | "el";

const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  value === "en" || value === "de" || value === "fr" || value === "es" || value === "el";

const mergeTranslations = <T extends Record<string, unknown>, U extends Record<string, unknown>>(
  base: T,
  extra: U,
) => ({ ...base, ...extra });

// Resources will be populated after loading translations
const resources: Partial<Record<SupportedLanguage, { translation: Record<string, unknown> }>> = {};

const RESOURCE_NAMESPACES = ["translation", "common"] as const;

const addAppResourceBundle = (lng: SupportedLanguage, translations: Record<string, unknown>) => {
  for (const ns of RESOURCE_NAMESPACES) {
    i18n.addResourceBundle(lng, ns, translations, true, true);
  }
  resources[lng] = { translation: translations };
};

const FALLBACK_LANGUAGE: SupportedLanguage = "en";

const detectLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") {
    return FALLBACK_LANGUAGE;
  }

  const stored = window.localStorage.getItem("fitvibe:language");
  if (isSupportedLanguage(stored)) {
    return stored;
  }

  const browser = window.navigator?.language?.slice(0, 2);
  if (isSupportedLanguage(browser)) {
    return browser;
  }

  return FALLBACK_LANGUAGE;
};

const initialLanguage = detectLanguage();

// Load translations on-demand (including English) to reduce initial bundle size
const hasLegalDocumentBundle = (lng: SupportedLanguage): boolean => {
  const terms = resources[lng]?.translation?.terms;
  return Boolean(terms && typeof terms === "object" && "section1" in terms);
};

const loadLanguage = async (lng: SupportedLanguage): Promise<void> => {
  if (resources[lng] && hasLegalDocumentBundle(lng)) {
    return;
  }

  try {
    // Dynamically import translation files only when needed
    // This includes English to allow proper code-splitting
    const modules = await Promise.all([
      import(`./locales/${lng}/common.json`),
      import(`./locales/${lng}/auth.json`),
      import(`./locales/${lng}/terms.json`),
      import(`./locales/${lng}/privacy.json`),
      import(`./locales/${lng}/cookie.json`),
    ]);

    const commonModule = modules[0] as { default: Record<string, unknown> };
    const authModule = modules[1] as { default: Record<string, unknown> };
    const termsModule = modules[2] as { default: Record<string, unknown> };
    const privacyModule = modules[3] as { default: Record<string, unknown> };
    const cookieModule = modules[4] as { default: Record<string, unknown> };

    const common = commonModule.default;
    const auth = authModule.default;
    const terms = termsModule.default;
    const privacy = privacyModule.default;
    const cookie = cookieModule.default;

    const translations = mergeTranslations(
      mergeTranslations(mergeTranslations(mergeTranslations(common, auth), { terms }), {
        privacy,
      }),
      { cookie },
    );

    addAppResourceBundle(lng, translations);
  } catch (error) {
    // Log error but don't fail - fallback to English
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Failed to load language ${lng}:`, error);
    }
    // Fallback to English if language loading fails
    if (lng !== "en") {
      // Try to load English as fallback
      await loadLanguage("en");
    }
  }
};

// Initialize i18n - use initReactI18next for both client and server
// Components use useTranslation hook which requires the React plugin
// I18nextProvider will provide the context during SSR
const i18nReady = i18n.use(initReactI18next).init({
  resources: {},
  lng: FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  defaultNS: "translation",
  fallbackNS: "common",
  ns: ["translation", "common"],
  interpolation: {
    escapeValue: false,
  },
  // SSR-safe: disable React suspense for server-side rendering
  react: {
    useSuspense: false,
  },
});

// Load minimal translations immediately for login page.
// Full translations load on-demand after login or on legal pages.
export const minimalTranslationsReady: Promise<void> = i18nReady.then(async () => {
  const minimalTranslations = await loadMinimalLoginTranslations();
  addAppResourceBundle("en", minimalTranslations);

  if (initialLanguage !== "en") {
    await loadLanguage(initialLanguage);
    await i18n.changeLanguage(initialLanguage);
    return;
  }
  await i18n.changeLanguage("en");
});

// Export function to load full translations when needed (e.g., after login)
export const loadFullTranslations = async (): Promise<void> => {
  if (hasLegalDocumentBundle("en")) {
    return;
  }

  const fullTranslations = await loadFullEnglishTranslations();
  addAppResourceBundle("en", fullTranslations);
};

export const ensureLegalTranslationsLoaded = async (): Promise<void> => {
  const code = i18n.language?.slice(0, 2);
  const lng = isSupportedLanguage(code) ? code : FALLBACK_LANGUAGE;
  await loadLanguage(lng);
};

// Export function to load languages on-demand
export const loadLanguageTranslations = loadLanguage;

export const ensurePrivateTranslationsLoaded = async () => {
  // Load full translations when user accesses protected routes (after login)
  await loadFullTranslations();
};

export const translationsLoadingPromise: Promise<void> = minimalTranslationsReady;

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    window.localStorage.setItem("fitvibe:language", lng);
    const code = lng.slice(0, 2);
    if (isSupportedLanguage(code)) {
      document.documentElement.lang = code;
    }
  });
}

export default i18n;
