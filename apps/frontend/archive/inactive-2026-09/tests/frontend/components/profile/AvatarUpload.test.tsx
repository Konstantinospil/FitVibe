import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarUpload } from "../../src/components/profile/AvatarUpload";

const post = vi.fn();
const del = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/services/api", () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
    defaults: { baseURL: "https://api.example.test" },
  },
}));

function jpegFile(size = 10) {
  return new File([new Uint8Array(size)], "avatar.jpg", { type: "image/jpeg" });
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  fireEvent.change(input);
}

describe("AvatarUpload", () => {
  beforeEach(() => {
    post.mockReset();
    del.mockReset();
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, "result", {
        configurable: true,
        value: "data:image/jpeg;base64,xx",
      });
      this.onloadend?.(new ProgressEvent("loadend"));
    });
  });

  it("rejects invalid type and oversized files", () => {
    const onError = vi.fn();
    render(<AvatarUpload onError={onError} maxSizeMB={0.000001} />);
    const input = document.getElementById("avatar-upload") as HTMLInputElement;

    setInputFiles(input, [new File(["x"], "avatar.gif", { type: "image/gif" })]);
    expect(onError).toHaveBeenCalledWith("settings.profile.avatarInvalidType");

    setInputFiles(input, [new File([new Uint8Array(20)], "big.jpg", { type: "image/jpeg" })]);
    expect(onError).toHaveBeenCalledWith("settings.profile.avatarTooLarge");
  });

  it("uploads a selected file", async () => {
    const onUploadSuccess = vi.fn();
    post.mockResolvedValue({ data: { fileUrl: "https://cdn.example/a.jpg" } });

    render(<AvatarUpload onUploadSuccess={onUploadSuccess} />);
    const input = document.getElementById("avatar-upload") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "settings.profile.avatarSelect" }));
    setInputFiles(input, [jpegFile()]);

    fireEvent.click(await screen.findByRole("button", { name: "settings.profile.avatarUpload" }));
    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith("https://cdn.example/a.jpg"));
  });

  it("deletes the current avatar and reports failures", async () => {
    const onDeleteSuccess = vi.fn();
    const onError = vi.fn();
    del.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("fail"));
    post.mockRejectedValue({
      response: { data: { error: { message: "server said no" } } },
    });

    const { rerender } = render(
      <AvatarUpload currentAvatarUrl="/avatars/me.jpg" onDeleteSuccess={onDeleteSuccess} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "settings.profile.avatarDelete" }));
    await waitFor(() => expect(onDeleteSuccess).toHaveBeenCalled());

    rerender(<AvatarUpload currentAvatarUrl="https://cdn.example/a.jpg" onError={onError} />);
    fireEvent.error(screen.getByAltText("Profile avatar"));
    expect(screen.getByText("Failed to load avatar image")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.profile.avatarDelete" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("settings.profile.avatarDeleteError"));

    rerender(<AvatarUpload onError={onError} />);
    const input = document.getElementById("avatar-upload") as HTMLInputElement;
    setInputFiles(input, [jpegFile()]);
    fireEvent.click(await screen.findByRole("button", { name: "settings.profile.avatarUpload" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("server said no"));
  });
});
