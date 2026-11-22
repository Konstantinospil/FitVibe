import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/api", () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

import { queryClient } from "../../src/lib/queryClient";
import { useAuthStore, type User } from "../../src/store/auth.store";

const userA: User = { id: "user-a", username: "a", email: "a@example.com", role: "athlete" };
const userB: User = { id: "user-b", username: "b", email: "b@example.com", role: "athlete" };
const PREFERENCES_KEY = ["settings", "preferences"];

// #634: the shared browser QueryClient uses account-agnostic keys, so one
// account's cached data must never be readable by the next account in the tab.
describe("auth store query-cache isolation", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    queryClient.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  it("clears cached account data on sign-out, so the next account cannot read it", async () => {
    useAuthStore.getState().signIn(userA);
    queryClient.setQueryData(PREFERENCES_KEY, { language: "de", owner: userA.id });

    await useAuthStore.getState().signOut();
    useAuthStore.getState().signIn(userB);

    expect(queryClient.getQueryData(PREFERENCES_KEY)).toBeUndefined();
  });

  it("clears cached data when a different account signs in without a sign-out", () => {
    useAuthStore.getState().signIn(userA);
    queryClient.setQueryData(PREFERENCES_KEY, { owner: userA.id });

    useAuthStore.getState().signIn(userB);

    expect(queryClient.getQueryData(PREFERENCES_KEY)).toBeUndefined();
  });

  it("clears data cached before the account was known (session restored after reload)", () => {
    // After a reload the session flag is set but `user` is null until sign-in.
    useAuthStore.setState({ isAuthenticated: true, user: null });
    queryClient.setQueryData(PREFERENCES_KEY, { owner: "unknown" });

    useAuthStore.getState().signIn(userB);

    expect(queryClient.getQueryData(PREFERENCES_KEY)).toBeUndefined();
  });

  it("keeps the cache when the same account refreshes its session", () => {
    useAuthStore.getState().signIn(userA);
    queryClient.setQueryData(PREFERENCES_KEY, { owner: userA.id });

    useAuthStore.getState().signIn({ ...userA, displayName: "A" });

    expect(queryClient.getQueryData(PREFERENCES_KEY)).toEqual({ owner: userA.id });
  });
});
