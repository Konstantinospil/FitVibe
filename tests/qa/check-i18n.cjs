#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const LOCALES = ["en", "de", "es", "fr", "el"];
const LOCALE_NAMES = {
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
  el: "Greek",
};

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing translation file: ${filePath}`);
    process.exit(1);
  }
}

const NAMESPACES = ["common", "auth", "terms", "privacy", "cookie"];
const translations = {};
for (const locale of LOCALES) {
  translations[locale] = {};
  for (const namespace of NAMESPACES) {
    const filePath = path.resolve(`apps/frontend/src/i18n/locales/${locale}/${namespace}.json`);
    ensureFile(filePath);
    // Prefix the namespace: identical keys in two bundles must be checked independently.
    translations[locale][namespace] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
}

const en = translations.en;

function flatten(obj, prefix = "") {
  const result = new Map();
  const entries = Array.isArray(obj) ? obj.entries() : Object.entries(obj ?? {});

  for (const [key, value] of entries) {
    const nextKey = prefix ? `${prefix}.${key}` : String(key);
    if (value && typeof value === "object") {
      for (const [childKey, childValue] of flatten(value, nextKey)) {
        result.set(childKey, childValue);
      }
    } else {
      result.set(nextKey, value);
    }
  }

  return result;
}

const enKeys = flatten(en);
const localeKeys = {};
for (const locale of LOCALES) {
  localeKeys[locale] = flatten(translations[locale]);
}

function diff(source, target, excludePrefix = null) {
  const missing = [];
  for (const key of source.keys()) {
    // Skip keys that start with the exclude prefix (e.g., "greekCharacters" for Greek)
    if (excludePrefix && key.startsWith(excludePrefix)) {
      continue;
    }
    if (!target.has(key)) {
      missing.push(key);
    }
  }
  return missing;
}

let hasErrors = false;

// Check all locales against English
for (const locale of LOCALES) {
  if (locale === "en") continue;

  const localeName = LOCALE_NAMES[locale];
  const keys = localeKeys[locale];
  // For Greek, exclude the greekCharacters section from comparison
  const excludePrefix = locale === "el" ? "greekCharacters" : null;
  const missingInLocale = diff(enKeys, keys, excludePrefix);
  const extraInLocale = diff(keys, enKeys, excludePrefix);

  if (missingInLocale.length || extraInLocale.length) {
    hasErrors = true;
    if (missingInLocale.length) {
      console.error(`Missing ${localeName} translations for keys:`);
      missingInLocale.forEach((key) => console.error(` - ${key}`));
    }
    if (extraInLocale.length) {
      console.error(`Extra ${localeName} keys without English equivalents:`);
      extraInLocale.forEach((key) => console.error(` - ${key}`));
    }
  }
}

// Check for empty keys in all locales
const emptyKeys = [];
for (const locale of LOCALES) {
  const keys = localeKeys[locale];
  for (const [key, value] of keys.entries()) {
    if (typeof value === "string" && value.trim().length === 0) {
      emptyKeys.push({ locale: LOCALE_NAMES[locale], key });
    }
    if (typeof value === "string" && locale !== "en" && enKeys.has(key)) {
      const tokens = (text) =>
        [...text.matchAll(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g)]
          .map((match) => match[1])
          .sort();
      const reference = tokens(String(enKeys.get(key)));
      const actual = tokens(value);
      if (JSON.stringify(reference) !== JSON.stringify(actual)) {
        hasErrors = true;
        console.error(`Interpolation mismatch for ${LOCALE_NAMES[locale]} ${key}: expected ${reference.join(", ")}, got ${actual.join(", ")}`);
      }
    }
  }
}

if (emptyKeys.length) {
  hasErrors = true;
  console.error("Translation keys must not be empty:");
  emptyKeys.forEach(({ locale, key }) => console.error(` - ${locale}: ${key}`));
}

if (hasErrors) {
  process.exit(1);
}

const keyCounts = LOCALES.map(
  (locale) => `${localeKeys[locale].size} ${locale.toUpperCase()}`,
).join(", ");
console.log(`i18n coverage check passed (${enKeys.size} EN keys, ${keyCounts}, 0 missing).`);
