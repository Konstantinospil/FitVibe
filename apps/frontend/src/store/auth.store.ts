import { create } from "zustand";
import { logout as apiLogout } from "../services/api";
import { queryClient } from "../lib/queryClient";
import { logger } from "../utils/logger";

/**
 * The browser QueryClient is shared by every account that uses this tab and
 * its keys are not user-scoped (e.g. ["settings", "preferences"]). Without a
 * clear, the next account in the same tab can read the previous account's
 * cached data within its stale window (#634).
 */
const clearAccountCache = (): void => {
  queryClient.clear();
};

/**
 * SECURITY FIX (CWE-922): Removed token storage from localStorage
 *
 * BEFORE: Tokens stored in localStorage via persist middleware → vulnerable to XSS
 * AFTER: Tokens only in HttpOnly cookies (set by backend) → immune to XSS
 *
 * The backend sets HttpOnly cookies on login/refresh, and axios sends them
 * automatically with withCredentials: true. No client-side token storage needed.
 */

export interface User {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  role?: string;
}

const AUTH_STORAGE_KEY = "fitvibe:auth";

const hasSessionFlag = (): boolean => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return false;
  }
  return window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "1";
};

const setAuthFlag = (value: boolean) => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  if (value) {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
  } else {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

const initialState = {
  // bootstrap.ts uses the same session flag to skip the hard redirect to /login.
  // Keep the React store in sync so a refresh in the same tab stays authenticated.
  isAuthenticated: hasSessionFlag(),
  user: null,
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,
  signIn: (user) => {
    // Keep cached data only when the same, already-known account signs in again.
    if (get().user?.id !== user.id) {
      clearAccountCache();
    }
    setAuthFlag(true);
    set({
      isAuthenticated: true,
      user,
    });
  },
  signOut: async () => {
    // Call logout endpoint to invalidate server-side session and clear cookies
    try {
      await apiLogout();
    } catch (error) {
      // Even if logout fails, clear local state
      // This ensures user is signed out locally even if network request fails
      logger.apiError("Logout error", error, "/api/v1/auth/logout", "POST");
    }
    setAuthFlag(false);
    clearAccountCache();
    set({ isAuthenticated: false, user: null });
  },
  updateUser: (user) =>
    set((state) => ({
      ...state,
      user,
    })),
}));
