import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderSettings, setupSettingsTests } from "./Settings.test.helpers";

describe("Settings - Avatar Upload", () => {
  beforeEach(() => setupSettingsTests());

  it("shows the avatar upload control in Profile", async () => {
    const { container } = renderSettings();
    await screen.findByDisplayValue("Test User");
    expect(container.querySelector("#avatar-upload")).toBeInTheDocument();
  });

  it("uploads a supported image", async () => {
    const { mockPost } = setupSettingsTests();
    const { container } = renderSettings();
    await screen.findByDisplayValue("Test User");
    const input = container.querySelector("#avatar-upload") as HTMLInputElement;
    const file = new File(["image"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole("button", { name: /upload/i }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/users/me/avatar",
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });
});
