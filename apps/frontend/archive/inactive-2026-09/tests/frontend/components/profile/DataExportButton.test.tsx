import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataExportButton } from "../../src/components/profile/DataExportButton";

const exportUserData = vi.fn();
const showToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  exportUserData: (...args: unknown[]) => exportUserData(...args),
}));

describe("DataExportButton", () => {
  beforeEach(() => {
    exportUserData.mockReset();
    showToast.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:export"),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL);
  });

  it("downloads an export from the confirmation modal", async () => {
    exportUserData.mockResolvedValue(new Blob(["zip"]));
    render(<DataExportButton />);

    fireEvent.click(screen.getByRole("button", { name: /settings.dataExport.export/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "settings.dataExport.download" }));
    await waitFor(() => expect(exportUserData).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "settings.dataExport.success",
      message: "settings.dataExport.successMessage",
    });
  });

  it("shows an error toast when the export fails", async () => {
    exportUserData.mockRejectedValue(new Error("fail"));
    render(<DataExportButton variant="ghost" size="sm" />);

    fireEvent.click(screen.getByRole("button", { name: /settings.dataExport.export/ }));
    fireEvent.click(screen.getByRole("button", { name: "settings.dataExport.download" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "settings.dataExport.failed",
        message: "settings.dataExport.failedMessage",
      }),
    );
  });

  it("closes the modal from cancel", () => {
    render(<DataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: /settings.dataExport.export/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
