/**
 * Consent module types
 */

export interface CookieConsent {
  id: string;
  ipAddress: string;
  consentVersion: string;
  legalVersionId: string | null;
  essentialCookies: boolean;
  preferencesCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
  consentGivenAt: string;
  lastUpdatedAt: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CookieConsentRow {
  id: string;
  user_id: string | null;
  client_key: string;
  consent_version: string;
  legal_version_id: string | null;
  source: string;
  essential_cookies: boolean;
  preferences_cookies: boolean;
  analytics_cookies: boolean;
  marketing_cookies: boolean;
  consent_given_at: string;
  user_agent: string | null;
  created_at: string;
}

export interface CreateCookieConsentInput {
  ipAddress: string;
  consentVersion: string;
  legalVersionId: string;
  essentialCookies: boolean;
  preferencesCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
  userAgent?: string | null;
}

export interface UpdateCookieConsentInput {
  consentVersion?: string;
  legalVersionId?: string;
  essentialCookies?: boolean;
  preferencesCookies?: boolean;
  analyticsCookies?: boolean;
  marketingCookies?: boolean;
  userAgent?: string | null;
}

export interface CookieConsentResponse {
  hasConsent: boolean;
  consent?: {
    essential: boolean;
    preferences: boolean;
    analytics: boolean;
    marketing: boolean;
    version: string;
    updatedAt: string;
  };
}
