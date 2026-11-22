import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../../src/components/ProtectedRoute";
import * as AuthContext from "../../src/contexts/AuthContext";
import type { User } from "../../src/store/auth.store";
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  getUserPreferences,
  type LegalDocumentsStatus,
} from "../../src/services/api";
import { discardSessionBootstrap, startSessionBootstrap } from "../../src/lib/sessionBootstrap";

vi.mock("../../src/contexts/AuthContext");
vi.mock("../../src/services/api", () => ({
  getLegalDocumentsStatus: vi.fn(),
  getAdministratorPasswordPolicyStatus: vi.fn(),
  getUserPreferences: vi.fn(),
}));

const mockUseAuth = vi.mocked(AuthContext.useAuth);
const legal = vi.mocked(getLegalDocumentsStatus);
const adminStatus = vi.mocked(getAdministratorPasswordPolicyStatus);

const doc = (needsAcceptance: boolean) => ({
  accepted: !needsAcceptance,
  acceptedAt: null,
  acceptedVersion: null,
  currentVersion: "v2",
  requiredVersion: "v2",
  requiredAction: "accept" as const,
  needsAcceptance,
});
const cleared: LegalDocumentsStatus = { terms: doc(false), privacy: doc(false) };
const termsPending: LegalDocumentsStatus = { terms: doc(true), privacy: doc(false) };
const athlete: User = { id: "user-a", username: "a", email: "a@example.com", role: "athlete" };

const authAs = (user: User | null) =>
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    user,
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  } as never);

const never = <T,>() => new Promise<T>(() => undefined);

const tree = () => (
  <MemoryRouter initialEntries={["/dashboard"]}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<div>Protected Content</div>} />
        <Route path="/admin/password-update" element={<div>Admin Password Update</div>} />
      </Route>
      <Route path="/terms-reacceptance" element={<div>Terms Reacceptance</div>} />
    </Routes>
  </MemoryRouter>
);

// #634: the guard adopts results that main.tsx requested early, but only for
// the identity they were requested for, and its decisions stay fail-closed.
describe("ProtectedRoute with early bootstrap requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discardSessionBootstrap();
    vi.mocked(getUserPreferences).mockResolvedValue({ language: "en" } as never);
  });

  afterEach(() => {
    cleanup();
    discardSessionBootstrap();
  });

  it("renders from the early results without requesting the checks again", async () => {
    legal.mockResolvedValueOnce(cleared);
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: false, minimumPasswordLength: 16 });
    startSessionBootstrap(true, null);
    authAs(null);

    render(tree());

    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
    expect(legal).toHaveBeenCalledTimes(1);
    expect(adminStatus).toHaveBeenCalledTimes(1);
  });

  it("still redirects when the early legal result requires re-acceptance", async () => {
    legal.mockResolvedValueOnce(termsPending);
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: false, minimumPasswordLength: 16 });
    startSessionBootstrap(true, null);
    authAs(null);

    render(tree());

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("still enforces the administrator password gate from the early result", async () => {
    legal.mockResolvedValueOnce(cleared);
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: true, minimumPasswordLength: 16 });
    startSessionBootstrap(true, null);
    authAs(null);

    render(tree());

    expect(await screen.findByText("Admin Password Update")).toBeInTheDocument();
  });

  it("fails closed when the early legal request failed", async () => {
    legal.mockRejectedValueOnce(new Error("unavailable"));
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: false, minimumPasswordLength: 16 });
    startSessionBootstrap(true, null);
    authAs(null);

    render(tree());

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
  });

  it("ignores early results requested for a different identity and checks fresh", async () => {
    // Requested after a reload (role unknown), consumed by a known member.
    legal.mockResolvedValueOnce(cleared);
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: false, minimumPasswordLength: 16 });
    startSessionBootstrap(true, null);
    legal.mockReturnValueOnce(never());
    authAs(athlete);

    render(tree());

    await waitFor(() => expect(legal).toHaveBeenCalledTimes(2));
    // Let the unrelated early result settle; the fresh check is still pending.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("requests the checks itself when nothing was started early", async () => {
    legal.mockResolvedValueOnce(cleared);
    adminStatus.mockResolvedValueOnce({ passwordChangeRequired: false, minimumPasswordLength: 16 });
    authAs(null);

    render(tree());

    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
    expect(legal).toHaveBeenCalledTimes(1);
    expect(adminStatus).toHaveBeenCalledTimes(1);
  });
});
