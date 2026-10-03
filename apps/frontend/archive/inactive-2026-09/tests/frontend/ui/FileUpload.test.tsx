import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileUpload } from "../../src/components/ui/FileUpload";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { maxSize?: string; name?: string }) => {
      if (key === "fileUpload.fileTooLarge") {
        return `too large ${options?.maxSize ?? ""}`;
      }
      if (key === "fileUpload.removeFile") {
        return `Remove ${options?.name ?? ""}`;
      }
      return key;
    },
  }),
}));

function dropFiles(target: HTMLElement, files: File[]) {
  fireEvent.drop(target, {
    dataTransfer: { files },
  });
}

describe("FileUpload", () => {
  it("renders the drop zone with optional label and helper text", () => {
    render(<FileUpload label="Avatar" helperText="PNG only" accept="image/png" />);

    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("PNG only")).toBeInTheDocument();
    expect(screen.getByText(/fileUpload.acceptedTypes/)).toBeInTheDocument();
    expect(screen.getByText(/fileUpload.maxSize/)).toBeInTheDocument();
  });

  it("selects a valid file from the input", async () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<FileUpload onFilesSelected={onFilesSelected} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await userEvent.upload(input, file);

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("5 B")).toBeInTheDocument();
  });

  it("rejects oversized files and invalid types", async () => {
    const { container } = render(<FileUpload accept="image/png" maxSize={4} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const large = new File(["hello"], "big.png", { type: "image/png" });
    const wrongType = new File(["x"], "doc.txt", { type: "text/plain" });

    await userEvent.upload(input, [large, wrongType]);

    expect(screen.getByRole("alert")).toHaveTextContent(/too large|fileUpload.invalidFileType/);
  });

  it("supports drag-and-drop, keyboard activation, and file removal", async () => {
    const onFileRemove = vi.fn();
    render(<FileUpload multiple onFileRemove={onFileRemove} />);

    const dropZone = screen.getByRole("button", { name: "fileUpload.dropZone" });
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    dropFiles(dropZone, [new File(["abc"], "a.txt", { type: "text/plain" })]);
    fireEvent.dragLeave(dropZone);

    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("3 B")).toBeInTheDocument();

    fireEvent.keyDown(dropZone, { key: "Enter" });
    fireEvent.keyDown(dropZone, { key: " " });

    await userEvent.click(screen.getByRole("button", { name: "Remove a.txt" }));
    expect(onFileRemove).toHaveBeenCalled();
    expect(screen.queryByText("a.txt")).not.toBeInTheDocument();
  });

  it("does not accept drops when disabled", () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload disabled onFilesSelected={onFilesSelected} />);

    const dropZone = screen.getByRole("button", { name: "fileUpload.dropZone" });
    expect(dropZone).toHaveAttribute("tabindex", "-1");
    dropFiles(dropZone, [new File(["x"], "x.txt", { type: "text/plain" })]);
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it("formats megabyte sizes", () => {
    render(<FileUpload maxSize={2 * 1024 * 1024} />);
    expect(screen.getByText(/2.0 MB/)).toBeInTheDocument();
  });

  it("shows an external error, formats KB/MB files, and ignores empty selections", async () => {
    const { container } = render(<FileUpload error="Pick a file" maxSize={5 * 1024 * 1024} />);
    expect(screen.getByText("Pick a file")).toBeInTheDocument();

    const dropZone = screen.getByRole("button", { name: "fileUpload.dropZone" });
    fireEvent.click(dropZone);
    fireEvent.keyDown(dropZone, { key: "Tab" });
    dropFiles(dropZone, []);

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: null } });

    const kilobyte = new File([new Uint8Array(2048)], "mid.bin", {
      type: "application/octet-stream",
    });
    Object.defineProperty(kilobyte, "size", { value: 2048 });
    await userEvent.upload(input, kilobyte);
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });
});
