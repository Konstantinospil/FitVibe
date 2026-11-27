import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageFilePicker } from "../../src/components/composites/ImageFilePicker";
import { IMAGE_UPLOAD_CONFIG } from "../../src/config/media";

const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Add photo"), { target: { files: [file] } });

describe("ImageFilePicker", () => {
  it("opens the file chooser from its button and passes on an accepted image", () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    render(<ImageFilePicker label="Add photo" onSelect={onSelect} onReject={onReject} />);
    const input = screen.getByLabelText<HTMLInputElement>("Add photo");
    const click = vi.spyOn(input, "click");

    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
    expect(click).toHaveBeenCalled();

    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    choose(file);
    expect(onSelect).toHaveBeenCalledWith(file);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("rejects a file the server would refuse", () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    render(<ImageFilePicker label="Add photo" onSelect={onSelect} onReject={onReject} />);

    choose(new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    const large = new File([new Uint8Array([1])], "big.png", { type: "image/png" });
    Object.defineProperty(large, "size", { value: IMAGE_UPLOAD_CONFIG.maxBytes + 1 });
    choose(large);

    expect(onReject.mock.calls).toEqual([["invalidType"], ["tooLarge"]]);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
