import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionForm } from "../../src/components/profile/AccountDeletionForm";

const deleteAccount = vi.fn();
const showToast = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

const tState = {
  impl: (key: string) => (key === "settings.accountDeletion.confirmText" ? "DELETE" : key),
};
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut }),
}));

vi.mock("../../src/services/api", () => ({
  deleteAccount: (...args: unknown[]) => deleteAccount(...args),
}));

describe("AccountDeletionForm", () => {
  beforeEach(() => {
    tState.impl = (key: string) =>
      key === "settings.accountDeletion.confirmText" ? "DELETE" : key;
    deleteAccount.mockReset().mockResolvedValue({ scheduledAt: "2026-01-15T00:00:00.000Z" });
    showToast.mockReset();
    signOut.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
  });

  it("opens the confirmation modal and deletes the account", async () => {
    const onDeleted = vi.fn();
    render(
      <MemoryRouter>
        <AccountDeletionForm onDeleted={onDeleted} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.deleteAccount" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/settings.accountDeletion.passwordLabel/), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.confirmDelete" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith({ password: "secret" }));
    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/login");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("shows a password error from the API", async () => {
    deleteAccount.mockRejectedValue(new Error("fail"));
    render(
      <MemoryRouter>
        <AccountDeletionForm />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.deleteAccount" }));
    fireEvent.change(screen.getByLabelText(/settings.accountDeletion.passwordLabel/), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.confirmDelete" }));

    expect(await screen.findByText("settings.accountDeletion.failed")).toBeInTheDocument();
  });

  it("closes the modal from cancel", () => {
    render(
      <MemoryRouter>
        <AccountDeletionForm />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.deleteAccount" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires the confirmation phrase and a password before deleting", () => {
    render(
      <MemoryRouter>
        <AccountDeletionForm />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.accountDeletion.deleteAccount" }));
    const confirm = screen.getByRole("button", { name: "settings.accountDeletion.confirmDelete" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "nope" } });
    fireEvent.click(confirm);
    expect(
      screen.queryByText("settings.accountDeletion.confirmationMismatch"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    expect(confirm).toBeDisabled();
  });

  it("uses English copy when translations are empty", () => {
    tState.impl = () => "";
    render(
      <MemoryRouter>
        <AccountDeletionForm />
      </MemoryRouter>,
    );

    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("Warning: This action cannot be undone")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));
    expect(screen.getByText("Confirm Account Deletion")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("DELETE")).toBeInTheDocument();
  });
});
