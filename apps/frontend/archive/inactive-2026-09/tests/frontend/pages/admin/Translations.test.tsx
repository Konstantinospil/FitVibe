import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../src/contexts/ToastContext";
import Translations from "../../src/pages/admin/Translations";

const listTranslations = vi.fn();
const createTranslation = vi.fn();
const updateTranslation = vi.fn();
const getTranslationMetadata = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toast = { error: toastError, success: toastSuccess };

vi.mock("../../src/services/translations.api", () => ({
  listTranslations: (...args: unknown[]) => listTranslations(...args),
  createTranslation: (...args: unknown[]) => createTranslation(...args),
  updateTranslation: (...args: unknown[]) => updateTranslation(...args),
  getTranslationMetadata: (...args: unknown[]) => getTranslationMetadata(...args),
}));

vi.mock("../../src/contexts/ToastContext", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useToast: () => toast,
}));

describe("Translations admin page", () => {
  beforeEach(() => {
    listTranslations.mockReset();
    createTranslation.mockReset();
    updateTranslation.mockReset();
    getTranslationMetadata.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();

    listTranslations.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });
    getTranslationMetadata.mockResolvedValue({
      data: { languages: ["en"], namespaces: ["common"] },
    });
  });

  it("loads translations and allows editing", async () => {
    listTranslations.mockResolvedValue({
      data: [
        {
          id: "1",
          namespace: "common",
          key_path: "navigation.home",
          language: "en",
          value: "Home",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z",
          deleted_at: null,
          created_by: null,
          updated_by: null,
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0 },
    });
    updateTranslation.mockResolvedValue({});

    const { container } = render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    expect(await screen.findByText("Translation Management")).toBeInTheDocument();
    await screen.findByText("Home");
    const editButton = await screen.findByTitle("Edit");
    fireEvent.click(editButton);
    const editField = await waitFor(() => {
      const field = container.querySelector("tbody textarea");
      if (!field) {
        throw new Error("Edit textarea not found");
      }
      return field;
    });
    fireEvent.change(editField, { target: { value: "Homepage" } });
    const saveButton = await waitFor(() => {
      const icon = container.querySelector("svg.lucide-save");
      const button = icon?.closest("button");
      if (!button) {
        throw new Error("Save button not found");
      }
      return button;
    });
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(updateTranslation).toHaveBeenCalledWith("en", "common", "navigation.home", {
        value: "Homepage",
      }),
    );
  });

  it("creates a new translation", async () => {
    listTranslations.mockResolvedValueOnce({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
    });
    createTranslation.mockResolvedValue({});

    render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByText("Add Translation"));
    fireEvent.change(screen.getByPlaceholderText("e.g., navigation.home or errors.notFound"), {
      target: { value: "new.key" },
    });
    fireEvent.change(screen.getByPlaceholderText("Translation value"), {
      target: { value: "New Value" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createTranslation).toHaveBeenCalledWith({
        namespace: "common",
        key_path: "new.key",
        language: "en",
        value: "New Value",
      }),
    );
  });

  it("applies filters and paginates results", async () => {
    listTranslations.mockResolvedValue({
      data: [
        {
          id: "1",
          namespace: "common",
          key_path: "navigation.home",
          language: "en",
          value: "Home",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z",
          deleted_at: null,
          created_by: null,
          updated_by: null,
        },
      ],
      pagination: { total: 120, limit: 50, offset: 0 },
    });
    getTranslationMetadata.mockResolvedValue({
      data: { languages: ["en", "fr"], namespaces: ["common", "auth"] },
    });

    render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    await screen.findByText("Translation Management");
    fireEvent.change(screen.getByPlaceholderText("Search by key or value..."), {
      target: { value: "welcome" },
    });
    fireEvent.change(screen.getByPlaceholderText("Filter by key path..."), {
      target: { value: "navigation" },
    });

    const [namespaceSelect, languageSelect] = screen.getAllByRole("combobox");
    fireEvent.change(namespaceSelect, { target: { value: "auth" } });
    fireEvent.change(languageSelect, { target: { value: "fr" } });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(listTranslations).toHaveBeenLastCalledWith({
        language: "fr",
        namespace: "auth",
        search: "welcome",
        keyPath: "navigation",
        activeOnly: undefined,
        limit: 50,
        offset: 50,
      }),
    );
  });

  it("shows validation errors for empty create form", async () => {
    render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByText("Add Translation"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(createTranslation).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Key path and value are required");
  });

  it("handles loading errors and metadata failures", async () => {
    listTranslations.mockRejectedValueOnce(new Error("Network down"));
    getTranslationMetadata.mockRejectedValueOnce(new Error("Metadata down"));

    render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Network down");
      expect(toastError).toHaveBeenCalledWith("Metadata down");
    });

    expect(await screen.findByText("No translations found")).toBeInTheDocument();
  });

  it("allows canceling an edit", async () => {
    listTranslations.mockResolvedValue({
      data: [
        {
          id: "1",
          namespace: "common",
          key_path: "navigation.home",
          language: "en",
          value: "Home",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z",
          deleted_at: null,
          created_by: null,
          updated_by: null,
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0 },
    });

    const { container } = render(
      <ToastProvider>
        <Translations />
      </ToastProvider>,
    );

    await screen.findByText("Home");
    fireEvent.click(await screen.findByTitle("Edit"));
    await waitFor(() => {
      const field = container.querySelector("tbody textarea");
      if (!field) {
        throw new Error("Edit textarea not found");
      }
      return field;
    });
    const cancelButton = await waitFor(() => {
      const icon = container.querySelector("svg.lucide-x");
      const button = icon?.closest("button");
      if (!button) {
        throw new Error("Cancel button not found");
      }
      return button;
    });
    fireEvent.click(cancelButton);

    await waitFor(() => expect(screen.queryByDisplayValue("Home")).not.toBeInTheDocument());
  });
});
