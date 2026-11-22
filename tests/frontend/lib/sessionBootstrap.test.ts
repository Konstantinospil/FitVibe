import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/api", () => ({
  getUserPreferences: vi.fn(),
  getLegalDocumentsStatus: vi.fn(),
  getAdministratorPasswordPolicyStatus: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  getUserPreferences,
  type LegalDocumentsStatus,
  type UserPreferences,
} from "../../src/services/api";
import {
  SESSION_BOOTSTRAP_MAX_AGE_MS,
  computeGuardKey,
  discardSessionBootstrap,
  startSessionBootstrap,
  takeBootstrapAdministratorPolicy,
  takeBootstrapLegalStatus,
  takeBootstrapPreferences,
} from "../../src/lib/sessionBootstrap";
import { useAuthStore, type User } from "../../src/store/auth.store";

const preferences = vi.mocked(getUserPreferences);
const legal = vi.mocked(getLegalDocumentsStatus);
const adminPolicy = vi.mocked(getAdministratorPasswordPolicyStatus);

const prefs = { language: "de" } as UserPreferences;
const legalStatus = { terms: {}, privacy: {} } as LegalDocumentsStatus;
const policy = { passwordChangeRequired: false, minimumPasswordLength: 16 };
const athlete: User = { id: "user-a", username: "a", email: "a@example.com", role: "athlete" };
const admin: User = { id: "admin-1", username: "ad", email: "ad@example.com", role: "admin" };
const reloadKey = computeGuardKey(true, null);

// #634: early bootstrap requests must save round trips without ever handing a
// guard result to a different identity or reusing one twice.
describe("session bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discardSessionBootstrap();
    preferences.mockResolvedValue(prefs);
    legal.mockResolvedValue(legalStatus);
    adminPolicy.mockResolvedValue(policy);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes the same identity classes as the guard", () => {
    expect(computeGuardKey(false, athlete)).toBe("signed-out");
    expect(computeGuardKey(true, null)).toBe("unknown-user|role-missing");
    expect(computeGuardKey(true, athlete)).toBe("user-a|member");
    expect(computeGuardKey(true, admin)).toBe("admin-1|admin");
    expect(computeGuardKey(true, { id: "s", role: "superadmin" })).toBe("s|admin");
  });

  it("starts nothing without a session", () => {
    startSessionBootstrap(false, null);
    expect(preferences).not.toHaveBeenCalled();
    expect(legal).not.toHaveBeenCalled();
    expect(adminPolicy).not.toHaveBeenCalled();
    expect(takeBootstrapPreferences()).toBeUndefined();
    expect(takeBootstrapLegalStatus("signed-out")).toBeUndefined();
  });

  it("starts all three requests at once after a reload, when the role is unknown", async () => {
    startSessionBootstrap(true, null);
    expect(preferences).toHaveBeenCalledTimes(1);
    expect(legal).toHaveBeenCalledTimes(1);
    expect(adminPolicy).toHaveBeenCalledTimes(1);

    await expect(takeBootstrapPreferences()).resolves.toBe(prefs);
    await expect(takeBootstrapLegalStatus(reloadKey)).resolves.toBe(legalStatus);
    await expect(takeBootstrapAdministratorPolicy(reloadKey)).resolves.toBe(policy);
  });

  it("skips the administrator check for a known member", () => {
    startSessionBootstrap(true, athlete);
    expect(adminPolicy).not.toHaveBeenCalled();
    expect(takeBootstrapAdministratorPolicy("user-a|member")).toBeUndefined();
    expect(takeBootstrapLegalStatus("user-a|member")).toBeDefined();
  });

  it("hands out each result once", () => {
    startSessionBootstrap(true, null);
    expect(takeBootstrapPreferences()).toBeDefined();
    expect(takeBootstrapPreferences()).toBeUndefined();
    expect(takeBootstrapLegalStatus(reloadKey)).toBeDefined();
    expect(takeBootstrapLegalStatus(reloadKey)).toBeUndefined();
    expect(takeBootstrapAdministratorPolicy(reloadKey)).toBeDefined();
    expect(takeBootstrapAdministratorPolicy(reloadKey)).toBeUndefined();
  });

  it("never hands a guard result to a different identity", () => {
    startSessionBootstrap(true, null);
    expect(takeBootstrapLegalStatus("user-b|member")).toBeUndefined();
    expect(takeBootstrapAdministratorPolicy("admin-1|admin")).toBeUndefined();
    expect(takeBootstrapLegalStatus("signed-out")).toBeUndefined();
  });

  it("does not hand out results older than the freshness window", () => {
    vi.useFakeTimers();
    startSessionBootstrap(true, null);
    vi.advanceTimersByTime(SESSION_BOOTSTRAP_MAX_AGE_MS + 1);
    expect(takeBootstrapPreferences()).toBeUndefined();
    expect(takeBootstrapLegalStatus(reloadKey)).toBeUndefined();
    expect(takeBootstrapAdministratorPolicy(reloadKey)).toBeUndefined();
  });

  it("passes a failed request to the consumer instead of hiding it", async () => {
    legal.mockRejectedValueOnce(new Error("legal status unavailable"));
    startSessionBootstrap(true, null);
    await expect(takeBootstrapLegalStatus(reloadKey)).rejects.toThrow("legal status unavailable");
  });

  it("does not raise an unhandled rejection for a failure nobody takes", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      legal.mockRejectedValueOnce(new Error("never taken"));
      startSessionBootstrap(true, null);
      discardSessionBootstrap();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("is discarded by sign-in and by sign-out", async () => {
    window.sessionStorage.clear();
    useAuthStore.setState({ isAuthenticated: true, user: null });

    startSessionBootstrap(true, null);
    useAuthStore.getState().signIn(athlete);
    expect(takeBootstrapPreferences()).toBeUndefined();
    expect(takeBootstrapLegalStatus(reloadKey)).toBeUndefined();

    startSessionBootstrap(true, athlete);
    await useAuthStore.getState().signOut();
    expect(takeBootstrapPreferences()).toBeUndefined();
    expect(takeBootstrapLegalStatus("user-a|member")).toBeUndefined();
  });
});
