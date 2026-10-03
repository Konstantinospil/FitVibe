import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { Modal, ModalFooter } from "../../src/components/ui/Modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        close: "close",
      };
      return translations[key] || key;
    },
  }),
}));

function getDialog(): HTMLElement {
  return screen.getByRole("dialog");
}

function getModalPanel(): HTMLElement {
  return getDialog().firstElementChild as HTMLElement;
}

describe("Modal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      const { container } = render(<Modal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render when isOpen is true", () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText("Modal content")).toBeInTheDocument();
    });

    it("should render with title", () => {
      render(<Modal {...defaultProps} title="Test Modal" />);
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
    });

    it("should render with description", () => {
      render(<Modal {...defaultProps} title="Test Modal" description="Test description" />);
      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("should render children in modal body", () => {
      render(
        <Modal {...defaultProps}>
          <div data-testid="custom-content">Custom content</div>
        </Modal>,
      );
      expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });

    it("should render footer when provided", () => {
      render(
        <Modal {...defaultProps}>
          <div>Modal content</div>
          <ModalFooter>
            <button type="button">Footer Button</button>
          </ModalFooter>
        </Modal>,
      );
      expect(screen.getByText("Footer Button")).toBeInTheDocument();
    });

    it("should not render header when title and showCloseButton are both false", () => {
      render(<Modal {...defaultProps} title={undefined} showCloseButton={false} />);
      const headers = screen.queryAllByRole("banner");
      expect(headers.length).toBe(0);
    });
  });

  describe("Size variants", () => {
    it("should apply sm size styles", () => {
      render(<Modal {...defaultProps} size="sm" />);
      expect(getModalPanel().style.maxWidth).toBe("28rem");
    });

    it("should apply md size styles (default)", () => {
      render(<Modal {...defaultProps} size="md" />);
      expect(getModalPanel().style.maxWidth).toBe("32rem");
    });

    it("should apply lg size styles", () => {
      render(<Modal {...defaultProps} size="lg" />);
      expect(getModalPanel().style.maxWidth).toBe("48rem");
    });

    it("should apply xl size styles", () => {
      render(<Modal {...defaultProps} size="xl" />);
      expect(getModalPanel().style.maxWidth).toBe("64rem");
    });
  });

  describe("Close button", () => {
    it("should render close button by default", () => {
      render(<Modal {...defaultProps} />);
      const closeButton = screen.getByLabelText("close");
      expect(closeButton).toBeInTheDocument();
    });

    it("should not render close button when showCloseButton is false", () => {
      render(<Modal {...defaultProps} showCloseButton={false} />);
      const closeButton = screen.queryByLabelText("close");
      expect(closeButton).not.toBeInTheDocument();
    });

    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      const closeButton = screen.getByLabelText("close");
      await userEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Overlay click", () => {
    it("should call onClose when overlay is clicked by default", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      fireEvent.click(getDialog());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when overlay is clicked and closeOnOverlayClick is false", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />);
      fireEvent.click(getDialog());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should not call onClose when modal content is clicked", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      fireEvent.click(getModalPanel());
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard interactions", () => {
    it("should call onClose when Escape key is pressed by default", async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when Escape key is pressed and closeOnEscape is false", async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);
      await userEvent.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Body scroll prevention", () => {
    it("should prevent body scroll when modal is open", () => {
      render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should restore body scroll when modal is closed", () => {
      const { rerender } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe("hidden");
      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Focus management", () => {
    it("should focus close button when modal opens", async () => {
      render(<Modal {...defaultProps} />);
      const closeButton = screen.getByLabelText("close");
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });
    });

    it("should make the dialog panel focusable", () => {
      render(<Modal {...defaultProps} />);
      expect(getModalPanel()).toHaveAttribute("tabindex", "-1");
    });

    it("should keep Tab focus inside the modal", async () => {
      const user = userEvent.setup();
      render(
        <Modal {...defaultProps} title="Trapped">
          <button type="button">Inside</button>
        </Modal>,
      );
      const closeButton = screen.getByLabelText("close");
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Inside" }));
      await user.tab();
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe("ARIA attributes", () => {
    it("should have proper ARIA attributes on overlay", () => {
      render(<Modal {...defaultProps} title="Test Modal" />);
      const overlay = getDialog();
      expect(overlay).toHaveAttribute("role", "dialog");
      expect(overlay).toHaveAttribute("aria-modal", "true");
      expect(overlay).toHaveAttribute("aria-labelledby", "modal-title");
    });

    it("should use title as accessible name when provided", () => {
      render(<Modal {...defaultProps} title="Test Title" />);
      expect(getDialog()).toHaveAccessibleName("Test Title");
    });

    it("should not set aria-labelledby when title is not provided", () => {
      render(<Modal {...defaultProps} />);
      expect(getDialog()).not.toHaveAttribute("aria-labelledby");
    });

    it("should set aria-describedby when description is provided", () => {
      render(<Modal {...defaultProps} title="Test" description="Description" />);
      expect(getDialog()).toHaveAttribute("aria-describedby", "modal-description");
      expect(screen.getByText("Description")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid open/close cycles", () => {
      const onClose = vi.fn();
      const { rerender } = render(<Modal {...defaultProps} onClose={onClose} />);
      rerender(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);
      rerender(<Modal {...defaultProps} onClose={onClose} />);
      rerender(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);
      expect(document.body.style.overflow).toBe("");
    });

    it("should handle multiple escape key presses", async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      await userEvent.keyboard("{Escape}");
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("should handle modal with no focusable elements", () => {
      render(
        <Modal {...defaultProps} showCloseButton={false}>
          <div>No focusable content</div>
        </Modal>,
      );
      expect(screen.getByText("No focusable content")).toBeInTheDocument();
    });
  });
});
