import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../../src/components/ProtectedRoute";
import * as AuthContext from "../../src/contexts/AuthContext";
import type { User } from "../../src/store/auth.store";
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  type LegalDocumentsStatus,
} from "../../src/services/api";

vi.mock("../../src/contexts/AuthContext");
vi.mock("../../src/services/api", () => ({
  getLegalDocumentsStatus: vi.fn(),
  getAdministratorPasswordPolicyStatus: vi.fn(),
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

const athleteA: User = { id: "user-a", username: "a", email: "a@example.com", role: "athlete" };
const athleteB: User = { id: "user-b", username: "b", email: "b@example.com", role: "athlete" };

const signIn = (user: User | null) =>
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    user,
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  } as never);

const never = <T,>() => new Promise<T>(() => undefined);

// A fresh element each call so rerender() actually re-renders the guard.
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

// #634: guard results must belong to the identity they were fetched for.
describe("ProtectedRoute identity binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not reuse user A's legal clearance for user B while B's check is pending", async () => {
    signIn(athleteA);
    legal.mockResolvedValueOnce(cleared);
    const { rerender } = render(tree());
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();

    legal.mockReturnValueOnce(never());
    signIn(athleteB);
    await act(async () => {
      rerender(tree());
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(legal).toHaveBeenCalledTimes(2);
  });

  it("applies user B's own legal result once it arrives", async () => {
    signIn(athleteA);
    legal.mockResolvedValueOnce(cleared);
    const { rerender } = render(tree());
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();

    legal.mockResolvedValueOnce(termsPending);
    signIn(athleteB);
    await act(async () => {
      rerender(tree());
    });

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
  });

  it("ignores a late result for the previous user", async () => {
    let resolveA!: (status: LegalDocumentsStatus) => void;
    legal.mockReturnValueOnce(
      new Promise<LegalDocumentsStatus>((resolve) => {
        resolveA = resolve;
      }),
    );
    signIn(athleteA);
    const { rerender } = render(tree());

    legal.mockReturnValueOnce(never());
    signIn(athleteB);
    await act(async () => {
      rerender(tree());
    });
    await act(async () => {
      resolveA(cleared);
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("re-checks the admin password gate when a member's role hydrates to admin", async () => {
    signIn(athleteA);
    legal.mockResolvedValue(cleared);
    const { rerender } = render(tree());
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
    expect(adminStatus).not.toHaveBeenCalled();

    adminStatus.mockReturnValueOnce(never());
    signIn({ ...athleteA, role: "admin" });
    await act(async () => {
      rerender(tree());
    });

    // Member clearance must not carry over to the administrator role.
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(adminStatus).toHaveBeenCalledTimes(1);
  });

  it("still fails closed for the new identity when its legal check errors", async () => {
    signIn(athleteA);
    legal.mockResolvedValueOnce(cleared);
    const { rerender } = render(tree());
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();

    legal.mockRejectedValueOnce(new Error("unavailable"));
    signIn(athleteB);
    await act(async () => {
      rerender(tree());
    });

    expect(await screen.findByText("Terms Reacceptance")).toBeInTheDocument();
  });
});
