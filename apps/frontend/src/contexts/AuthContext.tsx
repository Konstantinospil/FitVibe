import type React from "react";
import { createContext, useContext, useMemo } from "react";
import type { User } from "../store/auth.store";
import { useAuthStore } from "../store/auth.store";

/**
 * SECURITY FIX (CWE-922): Removed token exposure from context
 *
 * BEFORE: Exposed accessToken/refreshToken to all consuming components
 * AFTER: Only expose authentication state and user data
 *
 * Tokens are now in HttpOnly cookies (managed by backend + browser).
 * No client code needs direct access to tokens.
 */

interface AuthContextValue {
  isAuthenticated: boolean;
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  const updateUser = useAuthStore((state) => state.updateUser);

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      signIn,
      signOut,
      updateUser,
    }),
    [isAuthenticated, user, signIn, signOut, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export { AuthProvider, useAuth };
