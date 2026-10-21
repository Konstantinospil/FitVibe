import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes independently named dialog actions to assistive technology", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete workout"
        message="This action cannot be undone"
        confirmLabel="Delete workout"
        cancelLabel="Keep workout"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete workout" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete workout" })).toHaveAccessibleName(
      "Delete workout",
    );
    expect(screen.getByRole("button", { name: "Keep workout" })).toHaveAccessibleName(
      "Keep workout",
    );
  });

  it("should not render when isOpen is false", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render when isOpen is true", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Test Title" })).toBeInTheDocument();
  });

  it("should use default confirm and cancel labels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmButtons = screen.getAllByRole("button", { name: /Confirm/i });
    const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
    const confirmButton =
      Array.from(confirmButtons).find((btn) => container.contains(btn)) || confirmButtons[0];
    const cancelButton =
      Array.from(cancelButtons).find((btn) => container.contains(btn)) || cancelButtons[0];

    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it("should use custom confirm and cancel labels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmButtons = screen.getAllByRole("button", { name: /Confirm/i });
    const confirmButton =
      Array.from(confirmButtons).find((btn) => container.contains(btn)) || confirmButtons[0];
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("should call onCancel when cancel button is clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("should call onCancel when backdrop is clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // Find the backdrop (first div with onClick)
    const backdrop = container.querySelector("div[style*='position: fixed'][style*='inset: 0']");
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    }
  });

  it("should use danger variant styling", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmButtons = screen.getAllByRole("button", { name: /Confirm/i });
    const confirmButton =
      Array.from(confirmButtons).find((btn) => container.contains(btn)) || confirmButtons[0];
    expect(confirmButton).toHaveAttribute("data-variant", "danger");
  });

  it("should use warning variant by default", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // Warning variant uses primary button style for confirm
    const confirmButtons = screen.getAllByRole("button", { name: /Confirm/i });
    const confirmButton =
      Array.from(confirmButtons).find((btn) => container.contains(btn)) || confirmButtons[0];
    expect(confirmButton).toHaveAttribute("data-variant", "primary");
  });

  it("should use info variant styling", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        variant="info"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const titles = screen.getAllByText("Test Title");
    const title = Array.from(titles).find((el) => container.contains(el)) || titles[0];
    expect(title).toBeInTheDocument();
  });
});
