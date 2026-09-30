import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { useToast } from "../../src/components/ui/Toast";

const TestComponent: React.FC<{
  onShowToast?: (showToast: ReturnType<typeof useToast>["showToast"]) => void;
  onSuccess?: (success: ReturnType<typeof useToast>["success"]) => void;
  onError?: (error: ReturnType<typeof useToast>["error"]) => void;
  onWarning?: (warning: ReturnType<typeof useToast>["warning"]) => void;
  onInfo?: (info: ReturnType<typeof useToast>["info"]) => void;
}> = ({ onShowToast, onSuccess, onError, onWarning, onInfo }) => {
  const toast = useToast();
  return (
    <div>
      {onShowToast && (
        <button onClick={() => onShowToast(toast.showToast)}>Show via showToast</button>
      )}
      {onSuccess && <button onClick={() => onSuccess(toast.success)}>Success</button>}
      {onError && <button onClick={() => onError(toast.error)}>Error</button>}
      {onWarning && <button onClick={() => onWarning(toast.warning)}>Warning</button>}
      {onInfo && <button onClick={() => onInfo(toast.info)}>Info</button>}
    </div>
  );
};

describe("useToast (components/ui/Toast)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("showToast with title formats message as title: message", () => {
    let showToast: ReturnType<typeof useToast>["showToast"];
    render(
      <ToastProvider>
        <TestComponent
          onShowToast={(fn) => {
            showToast = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Show via showToast"));
    act(() => {
      showToast!({
        variant: "success",
        title: "Done",
        message: "Saved",
      });
    });
    expect(screen.getByText("Done: Saved")).toBeInTheDocument();
  });

  it("showToast without title uses message only", () => {
    let showToast: ReturnType<typeof useToast>["showToast"];
    render(
      <ToastProvider>
        <TestComponent
          onShowToast={(fn) => {
            showToast = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Show via showToast"));
    act(() => {
      showToast!({
        variant: "info",
        message: "No title here",
      });
    });
    expect(screen.getByText("No title here")).toBeInTheDocument();
  });

  it("showToast with duration passes duration to context", async () => {
    let showToast: ReturnType<typeof useToast>["showToast"];
    render(
      <ToastProvider>
        <TestComponent
          onShowToast={(fn) => {
            showToast = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Show via showToast"));
    act(() => {
      showToast!({
        variant: "success",
        message: "With duration",
        duration: 1000,
      });
    });
    expect(screen.getByText("With duration")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("With duration")).not.toBeInTheDocument();
  });

  it("success() shows success toast", () => {
    let success: ReturnType<typeof useToast>["success"];
    render(
      <ToastProvider>
        <TestComponent
          onSuccess={(fn) => {
            success = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Success"));
    act(() => {
      success!("Success message");
    });
    expect(screen.getByText("Success message")).toBeInTheDocument();
  });

  it("error() shows error toast", () => {
    let error: ReturnType<typeof useToast>["error"];
    render(
      <ToastProvider>
        <TestComponent
          onError={(fn) => {
            error = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Error"));
    act(() => {
      error!("Error message");
    });
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("warning() shows warning toast", () => {
    let warning: ReturnType<typeof useToast>["warning"];
    render(
      <ToastProvider>
        <TestComponent
          onWarning={(fn) => {
            warning = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Warning"));
    act(() => {
      warning!("Warning message");
    });
    expect(screen.getByText("Warning message")).toBeInTheDocument();
  });

  it("info() shows info toast", () => {
    let info: ReturnType<typeof useToast>["info"];
    render(
      <ToastProvider>
        <TestComponent
          onInfo={(fn) => {
            info = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Info"));
    act(() => {
      info!("Info message");
    });
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("success(message, duration) passes duration", async () => {
    let success: ReturnType<typeof useToast>["success"];
    render(
      <ToastProvider>
        <TestComponent
          onSuccess={(fn) => {
            success = fn;
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Success"));
    act(() => {
      success!("Quick toast", 500);
    });
    expect(screen.getByText("Quick toast")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText("Quick toast")).not.toBeInTheDocument();
  });
});
