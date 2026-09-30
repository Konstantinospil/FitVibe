import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { ToastProvider, useUiToastContext } from "../../src/components/ui/Toast";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function Probe() {
  const { addToast, showToast, removeToast, toasts } = useUiToastContext();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          addToast({
            message: "Hello toast",
            variant: "error",
            duration: 50,
            action: { label: "Undo", onClick: vi.fn() },
          })
        }
      >
        add
      </button>
      <button type="button" onClick={() => addToast({ message: "Stay", duration: 0 })}>
        sticky
      </button>
      <button
        type="button"
        onClick={() => showToast({ title: "Saved", message: "Profile", variant: "success" })}
      >
        titled
      </button>
      <button type="button" onClick={() => showToast({ message: "Only message" })}>
        message-only
      </button>
      <button type="button" onClick={() => showToast({ title: "Only title" })}>
        title-only
      </button>
      <button type="button" onClick={() => showToast({})}>
        empty
      </button>
      {toasts.map((toast) => (
        <button key={toast.id} type="button" onClick={() => removeToast(toast.id)}>
          dismiss-{toast.message}
        </button>
      ))}
    </div>
  );
}

describe("ToastProvider local context", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws outside the provider", () => {
    expect(() => render(<Probe />)).toThrow(/useUiToastContext/);
  });

  it("adds, auto-dismisses, and supports actions", () => {
    vi.useFakeTimers();

    render(
      <ToastProvider position="top-right">
        <Probe />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("add"));
    expect(screen.getByText("Hello toast")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
    fireEvent.mouseEnter(screen.getByText("Undo"));
    fireEvent.mouseLeave(screen.getByText("Undo"));
    fireEvent.click(screen.getByText("Undo"));
    fireEvent.mouseEnter(screen.getByLabelText("close"));
    fireEvent.mouseLeave(screen.getByLabelText("close"));
    fireEvent.click(screen.getByLabelText("close"));
    expect(screen.queryByText("Hello toast")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("sticky"));
    expect(screen.getByText("Stay")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("Stay")).toBeInTheDocument();

    fireEvent.click(screen.getByText("titled"));
    expect(screen.getByText("Saved: Profile")).toBeInTheDocument();
    fireEvent.click(screen.getByText("message-only"));
    expect(screen.getByText("Only message")).toBeInTheDocument();
    fireEvent.click(screen.getByText("title-only"));
    expect(screen.getByText("Only title")).toBeInTheDocument();
    fireEvent.click(screen.getByText("empty"));
  });
});
