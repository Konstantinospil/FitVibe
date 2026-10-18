import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/api";
import { initializeAnalytics, disableAnalytics } from "../utils/analytics";
import { initializeMarketing, disableMarketing } from "../utils/marketing";

export type CookieConsentSource = "banner" | "policy" | "settings";

export interface CookieConsentState {
  essential: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentStatus {
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

interface UseCookieConsentReturn {
  consentStatus: CookieConsentStatus | null;
  isLoading: boolean;
  error: Error | null;
  savePreferences: (preferences: CookieConsentState, source?: CookieConsentSource) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const CONSENT_STORAGE_KEY = "cookie-consent-banner-shown";

/**
 * Hook to manage cookie consent state
 * Fetches consent status from API and provides methods to save preferences
 */
export function useCookieConsent(): UseCookieConsentReturn {
  const [consentStatus, setConsentStatus] = useState<CookieConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConsentStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<{ success: boolean; data: CookieConsentStatus }>(
        "/api/v1/consent/cookie-status",
      );
      setConsentStatus(response.data.data);
    } catch (err) {
      // Check if it's a connection error (backend not running)
      const errMessage =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String(err.message)
            : String(err);
      const isConnectionError =
        err &&
        typeof err === "object" &&
        ("code" in err || "message" in err) &&
        (errMessage.includes("ECONNREFUSED") ||
          errMessage.includes("Network Error") ||
          errMessage.includes("ERR_NETWORK"));

      // Only set error state for non-connection errors (silently handle backend being down)
      if (!isConnectionError) {
        const error = err instanceof Error ? err : new Error("Failed to fetch consent status");
        setError(error);
      }

      // If API fails (including connection errors), default to no consent (show banner)
      setConsentStatus({ hasConsent: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConsentStatus();
  }, [fetchConsentStatus]);

  const savePreferences = useCallback(async (preferences: CookieConsentState, source?: CookieConsentSource) => {
    try {
      setError(null);
      const response = await apiClient.post<{
        success: boolean;
        data: {
          essential: boolean;
          preferences: boolean;
          analytics: boolean;
          marketing: boolean;
          version: string;
          updatedAt: string;
        };
      }>("/api/v1/consent/cookie-preferences", source ? { ...preferences, source } : preferences);

      // Update local state
      setConsentStatus({
        hasConsent: true,
        consent: {
          essential: response.data.data.essential,
          preferences: response.data.data.preferences,
          analytics: response.data.data.analytics,
          marketing: response.data.data.marketing,
          version: response.data.data.version,
          updatedAt: response.data.data.updatedAt,
        },
      });

      // Mark banner as shown in localStorage
      localStorage.setItem(CONSENT_STORAGE_KEY, "true");

      // Initialize analytics/marketing based on consent
      if (response.data.data.analytics) {
        initializeAnalytics();
      } else {
        disableAnalytics();
      }

      if (response.data.data.marketing) {
        initializeMarketing();
      } else {
        disableMarketing();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to save preferences");
      setError(error);
      throw error;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    await fetchConsentStatus();
  }, [fetchConsentStatus]);

  return {
    consentStatus,
    isLoading,
    error,
    savePreferences,
    refreshStatus,
  };
}

/**
 * Check if cookie consent banner should be shown
 * Returns true if banner should be shown (no consent or banner not shown before)
 */
export function shouldShowCookieBanner(): boolean {
  // Check localStorage flag
  const bannerShown = localStorage.getItem(CONSENT_STORAGE_KEY) === "true";
  if (bannerShown) {
    return false;
  }
  return true;
}
