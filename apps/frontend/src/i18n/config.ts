import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// Load minimal English translations for login page only
// This reduces initial bundle size significantly
export const loadMinimalLoginTranslations = async () => {
  // Only load auth.json for login page - other translations loaded on-demand.
  // The three chunks are independent; fetching them together avoids two extra
  // sequential round trips on every cold start (issue 634).
  const [enAuthModule, enCookieModule, minimalCommonModule] = await Promise.all([
    import("./locales/en/auth.json"),
    import("./locales/en/cookie.json"),
    import("./locales/en/minimal-login-common.json"),
  ]);
  const enAuth = enAuthModule.default as Record<string, unknown>;
  const minimalCommon = minimalCommonModule.default;

  return mergeTranslations(mergeTranslations(minimalCommon, enAuth), {
    cookie: enCookieModule.default,
  });
};

// The app's strings for signed-in pages: everything but the legal documents, which
// only the Terms and Privacy pages need (ensureLegalTranslationsLoaded). Loading
// them on every page cost two requests and 9.5 KB compressed at boot.
const loadAppBundle = async (lng: SupportedLanguage): Promise<Record<string, unknown>> => {
  const [commonModule, authModule, cookieModule] = (await Promise.all([
    import(`./locales/${lng}/common.json`),
    import(`./locales/${lng}/auth.json`),
    import(`./locales/${lng}/cookie.json`),
  ])) as { default: Record<string, unknown> }[];
  return mergeTranslations(mergeTranslations(commonModule.default, authModule.default), {
    cookie: cookieModule.default,
  });
};

const loadLegalBundle = async (lng: SupportedLanguage): Promise<Record<string, unknown>> => {
  const [termsModule, privacyModule] = (await Promise.all([
    import(`./locales/${lng}/terms.json`),
    import(`./locales/${lng}/privacy.json`),
  ])) as { default: Record<string, unknown> }[];
  return { terms: termsModule.default, privacy: privacyModule.default };
};

type SupportedLanguage = "en" | "de" | "fr" | "es" | "el";

const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  value === "en" || value === "de" || value === "fr" || value === "es" || value === "el";

const mergeTranslations = <T extends Record<string, unknown>, U extends Record<string, unknown>>(
  base: T,
  extra: U,
) => ({ ...base, ...extra });

// Languages whose app strings and legal documents are registered.
const appBundles = new Set<SupportedLanguage>();
const legalBundles = new Set<SupportedLanguage>();

const RESOURCE_NAMESPACES = ["translation", "common"] as const;

const addAppResourceBundle = (lng: SupportedLanguage, translations: Record<string, unknown>) => {
  for (const ns of RESOURCE_NAMESPACES) {
    i18n.addResourceBundle(lng, ns, translations, true, true);
  }
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

// Load a language's app strings on demand (English included, for code splitting).
const loadLanguage = async (lng: SupportedLanguage): Promise<void> => {
  if (appBundles.has(lng)) {
    return;
  }
  try {
    // A legal page in this session needs its strings in the new language too.
    const [appTranslations] = await Promise.all([
      loadAppBundle(lng),
      legalBundles.size > 0 ? loadLegal(lng) : Promise.resolve(),
    ]);
    addAppResourceBundle(lng, appTranslations);
    appBundles.add(lng);
  } catch (error) {
    // Log error but don't fail - fallback to English
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Failed to load language ${lng}:`, error);
    }
    if (lng !== "en") {
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
    // String bundles are added after first render (addAppResourceBundle), e.g.
    // the full English strings on public legal pages. Re-render translated
    // components when that happens; by default react-i18next only re-renders
    // on a language change, so headings like "terms.title" stayed as raw keys.
    bindI18nStore: "added",
  },
});

// Load minimal translations immediately for login page.
// Full translations load on-demand after login or on legal pages.
export const minimalTranslationsReady: Promise<void> = i18nReady.then(async () => {
  // The English fallback bundle and a non-English initial language are
  // independent downloads. Minimal English strings are an exact subset of the
  // full English bundle, so completion order cannot change any rendered text.
  const [minimalTranslations] = await Promise.all([
    loadMinimalLoginTranslations(),
    initialLanguage !== "en" ? loadLanguage(initialLanguage) : Promise.resolve(),
  ]);
  addAppResourceBundle("en", minimalTranslations);
  await i18n.changeLanguage(initialLanguage);
});

// Export function to load full translations when needed (e.g., after login)
// Shared in-flight request so an early start (main.tsx) and ProtectedRoutes
// await the same download instead of racing two loads.
let fullTranslationsInFlight: Promise<void> | undefined;

export const loadFullTranslations = (): Promise<void> => {
  if (appBundles.has("en")) {
    return Promise.resolve();
  }
  if (!fullTranslationsInFlight) {
    // The chunk download starts immediately; the bundle is only registered
    // once i18next has initialized.
    fullTranslationsInFlight = Promise.all([loadAppBundle("en"), i18nReady])
      .then(([appTranslations]) => {
        addAppResourceBundle("en", appTranslations);
        appBundles.add("en");
      })
      .finally(() => {
        // Allow a retry after a failed chunk request.
        fullTranslationsInFlight = undefined;
      });
  }
  return fullTranslationsInFlight;
};

const loadLegal = async (lng: SupportedLanguage): Promise<void> => {
  if (legalBundles.has(lng)) {
    return;
  }
  try {
    addAppResourceBundle(lng, await loadLegalBundle(lng));
    legalBundles.add(lng);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Failed to load legal documents for ${lng}:`, error);
    }
  }
};

/** The Terms and Privacy documents of the current language; nothing else. */
export const ensureLegalTranslationsLoaded = async (): Promise<void> => {
  const code = i18n.language?.slice(0, 2);
  await loadLegal(isSupportedLanguage(code) ? code : FALLBACK_LANGUAGE);
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
