import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../../src/components/ProtectedRoute";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
} from "../../src/services/api";

vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../src/services/api", () => ({
  getAdministratorPasswordPolicyStatus: vi.fn(),
  getLegalDocumentsStatus: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockStatus = vi.mocked(getAdministratorPasswordPolicyStatus);
const mockLegal = vi.mocked(getLegalDocumentsStatus);
const user = {
  id: "admin-one",
  username: "administrator",
  email: "admin@example.com",
  role: "admin",
};
const approvedLegal = {
  terms: {
    accepted: true,
    acceptedAt: "2026-10-01T12:00:00.000Z",
    acceptedVersion: "2026-10",
    currentVersion: "2026-10",
    requiredVersion: null,
    requiredAction: "none" as const,
    needsAcceptance: false,
  },
  privacy: {
    accepted: true,
    acceptedAt: "2026-10-01T12:00:00.000Z",
    acceptedVersion: "2026-10",
    currentVersion: "2026-10",
    requiredVersion: null,
    requiredAction: "none" as const,
    needsAcceptance: false,
  },
};

function signInAs(role: string | null) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    user: role === null ? null : { ...user, role },
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>Application home</p>} />
          <Route path="/dashboard" element={<p>Privileged dashboard</p>} />
          <Route path="/admin/password-update" element={<p>Administrator credential update</p>} />
          <Route path="/terms-reacceptance" element={<p>Terms review</p>} />
          <Route path="/privacy" element={<p>Privacy review</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Administrator password transition route guard (#557)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs("admin");
    mockLegal.mockResolvedValue(approvedLegal);
    mockStatus.mockResolvedValue({ passwordChangeRequired: false });
  });

  afterEach(cleanup);

  it.each(["admin", "superadmin"])(
    "redirects an MFA-authenticated legacy %s to credential update",
    async (role) => {
      signInAs(role);
      mockStatus.mockResolvedValue({ passwordChangeRequired: true });
      renderAt("/dashboard");
      expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
      expect(screen.queryByText("Privileged dashboard")).not.toBeInTheDocument();
      expect(mockStatus).toHaveBeenCalledOnce();
    },
  );

  it("allows the transition page while the legacy credential is unverified", async () => {
    mockStatus.mockResolvedValue({ passwordChangeRequired: true });
    renderAt("/admin/password-update");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
    expect(screen.queryByText("Application home")).not.toBeInTheDocument();
  });

  it("does not expose the password-update page after the credential is verified", async () => {
    renderAt("/admin/password-update");
    expect(await screen.findByText("Application home")).toBeInTheDocument();
    expect(screen.queryByText("Administrator credential update")).not.toBeInTheDocument();
  });

  it("allows a verified administrator to access ordinary application routes", async () => {
    renderAt("/dashboard");
    expect(await screen.findByText("Privileged dashboard")).toBeInTheDocument();
    expect(mockStatus).toHaveBeenCalledOnce();
  });

  it("does not query administrator status for a known athlete", async () => {
    signInAs("athlete");
    renderAt("/dashboard");
    expect(await screen.findByText("Privileged dashboard")).toBeInTheDocument();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it("resolves missing client-side role through the persisted server status", async () => {
    signInAs(null);
    mockStatus.mockResolvedValue({ passwordChangeRequired: true });
    renderAt("/dashboard");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
    expect(mockStatus).toHaveBeenCalledOnce();
  });

  it("fails closed on a transient administrator policy lookup outage", async () => {
    mockStatus.mockRejectedValue(new Error("database unreachable"));
    renderAt("/dashboard");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
    expect(screen.queryByText("Privileged dashboard")).not.toBeInTheDocument();
  });

  it("preserves MFA bootstrap enrollment on the explicit MFA-required response", async () => {
    mockStatus.mockRejectedValue({
      response: { data: { error: { code: "ADMIN_2FA_REQUIRED" } } },
    });
    renderAt("/dashboard");
    expect(await screen.findByText("Privileged dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Administrator credential update")).not.toBeInTheDocument();
  });

  it("fails closed when the status API error has no structured response", async () => {
    mockStatus.mockRejectedValue({ response: null });
    renderAt("/dashboard");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
  });

  it("fails closed when the status API error is an unknown error code", async () => {
    mockStatus.mockRejectedValue({
      response: { data: { error: { code: "ADMIN_STATUS_UNAVAILABLE" } } },
    });
    renderAt("/dashboard");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
  });

  it("keeps the transition route available during terms reacceptance", async () => {
    mockStatus.mockResolvedValue({ passwordChangeRequired: true });
    mockLegal.mockResolvedValue({
      ...approvedLegal,
      terms: { ...approvedLegal.terms, needsAcceptance: true, requiredAction: "accept" },
    });
    renderAt("/admin/password-update");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
  });

  it("handles legal-status failure while a legacy administrator changes password", async () => {
    mockStatus.mockResolvedValue({ passwordChangeRequired: true });
    mockLegal.mockRejectedValue(new Error("legal service outage"));
    renderAt("/admin/password-update");
    expect(await screen.findByText("Administrator credential update")).toBeInTheDocument();
  });

  it("redirects unauthenticated users rather than querying administrator status", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    });
    renderAt("/dashboard");
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    await waitFor(() => expect(mockStatus).not.toHaveBeenCalled());
    expect(mockLegal).not.toHaveBeenCalled();
  });

  it("does not redirect based on a stale status response after unmount", async () => {
    let resolveStatus!: (value: { passwordChangeRequired: boolean }) => void;
    mockStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    const view = renderAt("/dashboard");
    expect(screen.queryByText("Privileged dashboard")).not.toBeInTheDocument();
    view.unmount();
    resolveStatus({ passwordChangeRequired: true });
    await waitFor(() => expect(screen.queryByText("Administrator credential update")).not.toBeInTheDocument());
  });
});
