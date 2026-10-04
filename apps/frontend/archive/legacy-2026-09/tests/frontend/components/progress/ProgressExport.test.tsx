import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressExport } from "../../src/components/progress/ProgressExport";

const exportProgress = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
const apiError = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/contexts/ToastContext", () => ({
  useToast: () => toast,
}));

vi.mock("../../src/services/api", () => ({
  exportProgress: (...args: unknown[]) => exportProgress(...args),
}));

vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: (...args: unknown[]) => apiError(...args) },
}));

describe("ProgressExport", () => {
  beforeEach(() => {
    exportProgress.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    apiError.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:progress"),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL);
  });

  it("downloads a CSV export", async () => {
    exportProgress.mockResolvedValue(new Blob(["a,b"]));
    const onExportStart = vi.fn();
    const onExportSuccess = vi.fn();

    render(
      <ProgressExport
        format="csv"
        filename="custom.csv"
        onExportStart={onExportStart}
        onExportSuccess={onExportSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "progress.exportCsv" }));
    await waitFor(() => expect(exportProgress).toHaveBeenCalled());
    expect(onExportStart).toHaveBeenCalled();
    expect(onExportSuccess).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("progress.exportCsv");
  });

  it("uses the JSON label and reports errors", async () => {
    exportProgress.mockRejectedValue(new Error("fail"));
    const onExportError = vi.fn();

    render(<ProgressExport format="json" onExportError={onExportError} />);

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() => expect(onExportError).toHaveBeenCalledWith("progress.exportFailed"));
    expect(toast.error).toHaveBeenCalledWith("progress.exportFailed");
    expect(apiError).toHaveBeenCalled();
  });
});
