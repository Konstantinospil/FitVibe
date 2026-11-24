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
  /**
   * True when the last status request failed, so `consentStatus` is a
   * no-consent default rather than a confirmed answer from the server.
   */
  statusUnavailable: boolean;
  savePreferences: (preferences: CookieConsentState, source?: CookieConsentSource) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const CONSENT_STORAGE_KEY = "cookie-consent-banner-shown";
const CONSENT_STATUS_PATH = "/api/v1/consent/cookie-status";
const DEFAULT_RETRY_AFTER_MS = 2_000;
const MAX_RETRY_AFTER_MS = 10_000;

/**
 * Wait before the single retry of a transiently rejected status request
 * (429 rate limit or 503), honoring a numeric Retry-After header. Returns null
 * for any other failure, which is not retried.
 */
export function transientRetryDelayMs(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("response" in err)) {
    return null;
  }
  const response = (err as { response?: { status?: number; headers?: Record<string, unknown> } })
    .response;
  if (response?.status !== 429 && response?.status !== 503) {
    return null;
  }
  const header = response.headers?.["retry-after"];
  const seconds = typeof header === "string" || typeof header === "number" ? Number(header) : NaN;
  const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_RETRY_AFTER_MS;
  return Math.min(delay, MAX_RETRY_AFTER_MS);
}

/**
 * Hook to manage cookie consent state
 * Fetches consent status from API and provides methods to save preferences
 */
export function useCookieConsent(): UseCookieConsentReturn {
  const [consentStatus, setConsentStatus] = useState<CookieConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);

  const fetchConsentStatus = useCallback(async () => {
    const getStatus = () =>
      apiClient.get<{ success: boolean; data: CookieConsentStatus }>(CONSENT_STATUS_PATH);
    try {
      setIsLoading(true);
      setError(null);
      let response: Awaited<ReturnType<typeof getStatus>>;
      try {
        response = await getStatus();
      } catch (firstError) {
        // A rate-limited or briefly unavailable status check is retried once
        // while still loading, so it does not flash the banner (issue 634).
        const delay = transientRetryDelayMs(firstError);
        if (delay === null) {
          throw firstError;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        response = await getStatus();
      }
      setConsentStatus(response.data.data);
      setStatusUnavailable(false);
      // Restore optional integrations only after confirmed, current consent.
      if (response.data.data.hasConsent && response.data.data.consent) {
        if (response.data.data.consent.analytics) {
          initializeAnalytics();
        } else {
          disableAnalytics();
        }
        if (response.data.data.consent.marketing) {
          initializeMarketing();
        } else {
          disableMarketing();
        }
      }
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

      // If API fails (including connection errors), default to no consent. Optional
      // integrations stay off; the banner decides separately whether to re-prompt.
      setConsentStatus({ hasConsent: false });
      setStatusUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConsentStatus();
  }, [fetchConsentStatus]);

  const savePreferences = useCallback(
    async (preferences: CookieConsentState, source?: CookieConsentSource) => {
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

        setStatusUnavailable(false);
        localStorage.setItem(CONSENT_STORAGE_KEY, "true");

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
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    await fetchConsentStatus();
  }, [fetchConsentStatus]);

  return {
    consentStatus,
    isLoading,
    error,
    statusUnavailable,
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
