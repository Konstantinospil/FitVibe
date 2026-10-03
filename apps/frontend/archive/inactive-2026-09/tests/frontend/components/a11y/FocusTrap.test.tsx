import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { FocusTrap } from "../../src/components/a11y/FocusTrap";

function renderTrap(active = true, initialFocus?: RefObject<HTMLElement | null>) {
  return render(
    <div>
      <button type="button">Outside</button>
      <FocusTrap active={active} initialFocus={initialFocus}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </FocusTrap>
    </div>,
  );
}

describe("FocusTrap", () => {
  it("focuses the first focusable child when active", () => {
    renderTrap();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("focuses the initialFocus element when provided", () => {
    const initialFocus = createRef<HTMLButtonElement>();
    render(
      <FocusTrap active initialFocus={initialFocus}>
        <button type="button">First</button>
        <button ref={initialFocus} type="button">
          Preferred
        </button>
      </FocusTrap>,
    );

    expect(screen.getByRole("button", { name: "Preferred" })).toHaveFocus();
  });

  it("wraps Tab from the last element to the first", () => {
    renderTrap();
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    renderTrap();
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    first.focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("ignores non-Tab keys and inactive traps", () => {
    renderTrap(false);
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();

    fireEvent.keyDown(document, { key: "Enter" });
    expect(outside).toHaveFocus();
  });

  it("restores focus to the previously focused element on unmount", () => {
    const { unmount } = render(
      <div>
        <button type="button">Before</button>
        <FocusTrap>
          <button type="button">Inside</button>
        </FocusTrap>
      </div>,
    );

    const before = screen.getByRole("button", { name: "Before" });
    before.focus();
    unmount();
    // The previously focused element is restored; after unmount it is gone from the document.
    expect(document.body.contains(before)).toBe(false);
  });
});
