import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

// Mock i18next
const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "components.errorBoundary.title": "Something went wrong",
    "components.errorBoundary.message": "An unexpected error occurred",
    "components.errorBoundary.tryAgain": "Try Again",
  };
  return translations[key] || key;
};

vi.mock("react-i18next", () => ({
  withTranslation: () => (Component: React.ComponentType<any>) => {
    return (props: any) => <Component {...props} t={mockT} i18n={{}} tReady={true} />;
  },
  useTranslation: () => ({
    t: mockT,
    i18n: {},
    ready: true,
  }),
}));

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Normal Content</div>;
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress error console logs during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("should render children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Child Component</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child Component")).toBeInTheDocument();
  });

  it("should render error UI when child throws error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
    const tryAgainText = screen.getByText(/try again/i);
    expect(tryAgainText).toBeInTheDocument();
    const button = tryAgainText.closest("button");
    expect(button).toBeInTheDocument();
  });

  it("should render fallback UI when provided", () => {
    const fallback = <div>Custom Error Fallback</div>;
    const { container } = render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom Error Fallback")).toBeInTheDocument();
    // Check that default error UI is not in the container
    const defaultErrorTexts = screen.queryAllByText("Something went wrong");
    const defaultErrorInContainer = defaultErrorTexts.find((el) => container.contains(el));
    expect(defaultErrorInContainer).toBeUndefined();
  });

  it("should call onError callback when error is caught", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test error" }),
      expect.any(Object),
    );
  });

  it("should reset error state when Try Again is clicked", () => {
    const { rerender, container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Initial error state - find button by text
    const tryAgainButtons = screen.getAllByText(/try again/i);
    const tryAgainButton = tryAgainButtons
      .find((btn) => {
        const button = btn.closest("button");
        return button && container.contains(button);
      })
      ?.closest("button");
    expect(tryAgainButton).toBeInTheDocument();

    const errorTexts = screen.getAllByText("Something went wrong");
    const errorText = Array.from(errorTexts).find((el) => container.contains(el)) || errorTexts[0];
    expect(errorText).toBeInTheDocument();

    // First, update the child to not throw anymore
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    // Error UI should still be showing because error boundary caught the initial error
    const errorTexts2 = screen.getAllByText("Something went wrong");
    const errorText2 =
      Array.from(errorTexts2).find((el) => container.contains(el)) || errorTexts2[0];
    expect(errorText2).toBeInTheDocument();

    // Click Try Again to reset and render the (now non-throwing) child
    const tryAgainBtns = screen.getAllByText(/try again/i);
    const tryAgainBtn = tryAgainBtns
      .find((btn) => {
        const button = btn.closest("button");
        return button && container.contains(button);
      })
      ?.closest("button");
    if (tryAgainBtn) {
      fireEvent.click(tryAgainBtn);
    }

    // Now the child should render normally
    expect(screen.getByText("Normal Content")).toBeInTheDocument();
  });

  it("should display default error message when error has no message", () => {
    const ThrowErrorWithoutMessage = () => {
      const error = new Error();
      error.message = "";
      throw error;
    };

    render(
      <ErrorBoundary>
        <ThrowErrorWithoutMessage />
      </ErrorBoundary>,
    );

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
  });

  it("should apply correct styling to error container", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const errorContainer = screen.getByText("Test error").closest("div");
    expect((errorContainer as HTMLElement).style.padding).toBe("2rem");
    expect((errorContainer as HTMLElement).style.textAlign).toBe("center");
  });

  it("should not call onError when no error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <div>Normal Content</div>
      </ErrorBoundary>,
    );

    expect(onError).not.toHaveBeenCalled();
  });

  it("should render multiple children correctly", () => {
    render(
      <ErrorBoundary>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child 1")).toBeInTheDocument();
    expect(screen.getByText("Child 2")).toBeInTheDocument();
    expect(screen.getByText("Child 3")).toBeInTheDocument();
  });
});
