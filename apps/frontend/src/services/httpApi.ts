import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { useAuthStore } from "../store/auth.store";
// Use relative URLs in development (Vite proxy handles /api -> localhost:4000)
// Use full URL in production or when VITE_API_URL is explicitly set
// SSR-safe: Check if we're on the server (Node.js) - use process.env, otherwise use import.meta.env
const getApiUrl = () => {
  // During server-side rendering, backend is reachable through
  // Docker's internal network.
  if (typeof window === "undefined") {
    return process.env.VITE_API_URL || process.env.API_URL || "http://backend:4000";
  }

  // Explicit build-time configuration takes precedence.
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Vite development server uses its development proxy.
  if (import.meta.env.DEV) {
    return "";
  }

  // Production browser: backend runs on the same Pi on port 4000.
  return `${window.location.protocol}//${window.location.hostname}:4000`;
};

const API_URL = getApiUrl();

/**
 * SECURITY FIX (CWE-922): Cookie-based authentication
 *
 * BEFORE: Tokens in localStorage + manual Authorization header injection
 * AFTER: HttpOnly cookies sent automatically by browser
 *
 * The backend sets HttpOnly cookies (accessToken, refreshToken) on:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/refresh
 *
 * Axios sends cookies automatically with withCredentials: true.
 * No Authorization header needed - cookies are immune to XSS attacks.
 */

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export type HealthStatusResponse = {
  status: string;
  uptime?: number;
  version?: string;
  timestamp?: string;
};

const baseConfig = {
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true, // ✅ Send HttpOnly cookies automatically
};

export const apiClient = axios.create(baseConfig);

// Separate client without interceptors to avoid circular refresh attempts.
export const rawHttpClient = axios.create(baseConfig);

let cachedCsrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = rawHttpClient
      .get<{ csrfToken: string }>("/api/v1/csrf-token")
      .then((response) => {
        cachedCsrfToken = response.data.csrfToken;
        return response.data.csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
}

async function attachCsrfToken(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? "get").toLowerCase();

  if (!["post", "put", "patch", "delete"].includes(method)) {
    return config;
  }

  const csrfToken = await getCsrfToken();
  config.headers.set("X-CSRF-Token", csrfToken);

  return config;
}

apiClient.interceptors.request.use(attachCsrfToken);
rawHttpClient.interceptors.request.use(attachCsrfToken);

let isRefreshing = false;

type QueueEntry = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: RetryableRequestConfig;
};

const refreshQueue: QueueEntry[] = [];

const enqueueRequest = (config: RetryableRequestConfig) =>
  new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject, config });
  });

const processQueue = (error: unknown) => {
  while (refreshQueue.length > 0) {
    const { resolve, reject, config } = refreshQueue.shift() as QueueEntry;
    if (error) {
      // SECURITY FIX: Removed useless conditional - if error is truthy, use it directly
      reject(error);
      continue;
    }

    // Retry with refreshed cookies
    apiClient(config).then(resolve).catch(reject);
  }
};

const requestTokenRefresh = async (): Promise<void> => {
  // Backend reads refresh token from HttpOnly cookie
  // No need to send anything in the body
  await rawHttpClient.post("/api/v1/auth/refresh");
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    const originalRequest = config as RetryableRequestConfig | undefined;

    if (!originalRequest || !response) {
      return Promise.reject(error);
    }

    // Only attempt refresh on 401, and only once per request
    if (response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Queue concurrent requests during refresh
    if (isRefreshing) {
      return enqueueRequest(originalRequest);
    }

    isRefreshing = true;

    try {
      // Refresh the HttpOnly cookies
      await requestTokenRefresh();

      // Process queued requests (cookies are now fresh)
      processQueue(null);

      // Retry the original request with fresh cookies
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Check if error is due to outdated terms
      if (refreshError && typeof refreshError === "object" && "response" in refreshError) {
        const axiosError = refreshError as {
          response?: { data?: { error?: { code?: string } } };
        };
        const errorCode = axiosError.response?.data?.error?.code;

        if (errorCode === "TERMS_VERSION_OUTDATED") {
          // Redirect to terms re-acceptance page
          processQueue(refreshError);
          window.location.href = "/terms-reacceptance";
          const error =
            refreshError instanceof Error ? refreshError : new Error(JSON.stringify(refreshError));
          return Promise.reject(error);
        }
      }

      // Refresh failed - sign out and clear cookies
      processQueue(refreshError);
      useAuthStore
        .getState()
        .signOut()
        .catch(() => {
          // Ignore sign out errors during token refresh failure
        });

      // Optionally call logout endpoint to clear server-side session
      try {
        await rawHttpClient.post("/api/v1/auth/logout");
      } catch {
        // Ignore logout errors during error handling
      }

      const error = refreshError instanceof Error ? refreshError : new Error(String(refreshError));
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export async function getHealthStatus(): Promise<HealthStatusResponse> {
  const res = await apiClient.get<HealthStatusResponse>("/health");
  return res.data;
}

export type SubmitContactRequest = {
  email: string;
  topic: string;
  message: string;
};

export type SubmitContactResponse = {
  success: boolean;
  data: {
    id: string;
    createdAt: string;
  };
};

export async function submitContact(payload: SubmitContactRequest): Promise<SubmitContactResponse> {
  const res = await rawHttpClient.post<SubmitContactResponse>("/api/v1/contact", payload);
  return res.data;
}
