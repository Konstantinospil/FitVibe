export type LegalUserAction = "none" | "acknowledge" | "accept" | "renew_consent";

interface LegalDocumentDefinition {
  filename: string;
  allowedActions: readonly LegalUserAction[];
}

export const LEGAL_DOCUMENT_REGISTRY = {
  terms: {
    filename: "terms.json",
    allowedActions: ["none", "accept"],
  },
  privacy: {
    filename: "privacy.json",
    allowedActions: ["none", "acknowledge", "accept", "renew_consent"],
  },
  cookie: {
    filename: "cookie.json",
    allowedActions: ["none", "renew_consent"],
  },
} as const satisfies Record<string, LegalDocumentDefinition>;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_REGISTRY;

interface LegalLanguageDefinition {
  directory: string;
  locale: string;
}

export const LEGAL_LANGUAGE_REGISTRY = {
  en: { directory: "en", locale: "en" },
  de: { directory: "de", locale: "de" },
  fr: { directory: "fr", locale: "fr" },
  es: { directory: "es", locale: "es" },
  el: { directory: "el", locale: "el" },
} as const satisfies Record<string, LegalLanguageDefinition>;

export type SupportedLegalLanguage = keyof typeof LEGAL_LANGUAGE_REGISTRY;

export const LEGAL_DOCUMENT_TYPES = Object.keys(
  LEGAL_DOCUMENT_REGISTRY,
) as LegalDocumentType[];

export const SUPPORTED_LEGAL_LANGUAGES = Object.keys(
  LEGAL_LANGUAGE_REGISTRY,
) as SupportedLegalLanguage[];

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return Object.hasOwn(LEGAL_DOCUMENT_REGISTRY, value);
}

export function toSupportedLegalLanguage(value: string): SupportedLegalLanguage | null {
  return Object.hasOwn(LEGAL_LANGUAGE_REGISTRY, value)
    ? (value as SupportedLegalLanguage)
    : null;
}

export function getLegalDocumentDefinition(
  documentType: LegalDocumentType,
): LegalDocumentDefinition {
  return LEGAL_DOCUMENT_REGISTRY[documentType];
}

export function getLegalLanguageDefinition(
  language: SupportedLegalLanguage,
): LegalLanguageDefinition {
  return LEGAL_LANGUAGE_REGISTRY[language];
}
