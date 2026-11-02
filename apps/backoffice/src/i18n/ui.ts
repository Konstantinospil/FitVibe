import { useCallback, useSyncExternalStore } from "react";
import english from "./en.json";
import german from "./de.json";
import french from "./fr.json";
import spanish from "./es.json";
import greek from "./el.json";

export type BackofficeLocale = "en" | "de" | "fr" | "es" | "el";

const translations: Record<BackofficeLocale, Record<string, string>> = {
  en: english,
  de: german,
  fr: french,
  es: spanish,
  el: greek,
};

const supported = new Set<BackofficeLocale>(["en", "de", "fr", "es", "el"]);
const languageEvent = "fitvibe-backoffice-language-changed";

function isLocale(value: string): value is BackofficeLocale {
  return supported.has(value as BackofficeLocale);
}

export function activeLanguage(): BackofficeLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("fitvibe:language")?.slice(0, 2).toLowerCase();
  const browser = window.navigator.language.slice(0, 2).toLowerCase();
  if (stored && isLocale(stored)) {
    return stored;
  }
  return isLocale(browser) ? browser : "en";
}

export function setBackofficeLanguage(locale: BackofficeLocale): void {
  window.localStorage.setItem("fitvibe:language", locale);
  window.dispatchEvent(new Event(languageEvent));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(languageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(languageEvent, callback);
  };
}

export function translate(
  key: string,
  values?: Record<string, string | number>,
  locale: BackofficeLocale = activeLanguage(),
): string {
  const template = translations[locale][key] ?? translations.en[key];
  if (template === undefined) {
    throw new Error("Unknown Backoffice translation key: " + key);
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    String(values?.[name] ?? "{" + name + "}"),
  );
}

export function useUiText(): (key: string, values?: Record<string, string | number>) => string {
  const language = useSyncExternalStore(subscribe, activeLanguage, () => "en");
  return useCallback(
    (key: string, values?: Record<string, string | number>) => translate(key, values, language),
    [language],
  );
}
