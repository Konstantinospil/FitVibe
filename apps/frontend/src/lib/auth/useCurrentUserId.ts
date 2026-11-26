import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../../services/accountApi";
import { useAuthStore } from "../../store/auth.store";

/** Shared with Settings, which reads the same profile. */
export const CURRENT_USER_QUERY_KEY = ["settings", "profile"] as const;

/**
 * The signed-in user's id. The auth store only holds the user after a sign-in in
 * this tab; after a reload it keeps the session but not the user, so the id then
 * comes from the profile API. Undefined while that request is pending.
 *
 * Lives in `lib/`, not `hooks/`: it is shared by lazily loaded pages, and the
 * build groups small shared hooks into the eagerly loaded `shared-small` chunk
 * (see vite.config.ts), which would add the profile API to every first load.
 */
export function useCurrentUserId(): string | undefined {
  const storedId = useAuthStore((state) => state.user?.id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profile = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: isAuthenticated && !storedId,
  });
  return storedId ?? profile.data?.id;
}
