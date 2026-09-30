import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupCodesDisplay } from "../../src/components/auth/BackupCodesDisplay";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const codes = ["AAAA-1111", "BBBB-2222"];

describe("BackupCodesDisplay", () => {
  const originalClipboard = navigator.clipboard;
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:codes"),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL);
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("masks codes until shown", () => {
    render(<BackupCodesDisplay backupCodes={codes} />);
    expect(screen.getAllByText("•".repeat(codes[0].length))).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /common.show/ }));
    expect(screen.getByText("AAAA-1111")).toBeInTheDocument();
  });

  it("copies one code and all codes", async () => {
    const onCodesCopied = vi.fn();
    render(<BackupCodesDisplay backupCodes={codes} onCodesCopied={onCodesCopied} />);

    fireEvent.click(screen.getAllByRole("button", { name: "common.copy" })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("AAAA-1111"));

    fireEvent.click(screen.getByRole("button", { name: /common.copyAll/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("AAAA-1111\nBBBB-2222"));
    expect(onCodesCopied).toHaveBeenCalled();
  });

  it("downloads the backup codes", () => {
    const onDownload = vi.fn();
    render(<BackupCodesDisplay backupCodes={codes} onDownload={onDownload} />);

    fireEvent.click(screen.getByRole("button", { name: /common.download/ }));
    expect(onDownload).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("falls back to execCommand when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    render(<BackupCodesDisplay backupCodes={codes} />);
    fireEvent.click(screen.getAllByRole("button", { name: "common.copy" })[0]);
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });
});
