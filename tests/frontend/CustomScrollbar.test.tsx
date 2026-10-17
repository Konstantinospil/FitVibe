import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomScrollbar } from "../../apps/frontend/src/components/CustomScrollbar";

let notifyResize: (() => void) | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    notifyResize = () => callback([], this as unknown as ResizeObserver);
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

const setDimension = (element: Element, key: string, value: number) => {
  Object.defineProperty(element, key, { configurable: true, value });
};

const setup = (scrollHeight = 600, clientHeight = 200) => {
  const result = render(
    <CustomScrollbar label="Test scrollbar" className="test-shell" viewportClassName="test-viewport">
      <p>Scrollable content</p>
    </CustomScrollbar>,
  );
  const viewport = result.container.querySelector(".custom-scrollbar__viewport") as HTMLDivElement;
  const track = result.container.querySelector(".custom-scrollbar__track") as HTMLDivElement;
  const thumb = result.container.querySelector(".custom-scrollbar__thumb") as HTMLDivElement;
  setDimension(viewport, "scrollHeight", scrollHeight);
  setDimension(viewport, "clientHeight", clientHeight);
  // jsdom does not clamp scrollTop; real browser scroll containers do.
  let scrollTop = 0;
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, Math.min(scrollHeight - clientHeight, value));
    },
  });
  setDimension(track, "clientHeight", 200);
  setDimension(thumb, "offsetHeight", 20);
  act(() => notifyResize?.());
  const scrollbar = track;
  if (scrollHeight > clientHeight + 1) {
    expect(screen.getByRole("scrollbar", { name: "Test scrollbar" })).toBe(track);
  } else {
    expect(screen.queryByRole("scrollbar", { name: "Test scrollbar" })).toBeNull();
  }
  return { ...result, scrollbar, viewport, track, thumb };
};

describe("CustomScrollbar", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    observe.mockClear();
    disconnect.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects the accessible track to the viewport and observes content changes", () => {
    const { container, scrollbar, viewport, unmount } = setup();
    expect(scrollbar.getAttribute("aria-controls")).toBe(viewport.id);
    expect(scrollbar.getAttribute("aria-orientation")).toBe("vertical");
    expect(scrollbar.getAttribute("aria-valuenow")).toBe("0");
    expect(scrollbar.getAttribute("tabindex")).toBe("0");
    expect(container.firstElementChild).toHaveClass("test-shell");
    expect(viewport).toHaveClass("test-viewport");
    expect(observe).toHaveBeenCalledTimes(2);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("remains inaccessible for dragging when content does not overflow", () => {
    const { scrollbar, viewport, track, thumb } = setup(200, 200);
    expect(track.dataset.scrollable).toBe("false");
    expect(scrollbar.getAttribute("tabindex")).toBe("-1");
    fireEvent.pointerDown(thumb, { pointerId: 4, clientY: 60 });
    fireEvent.pointerDown(track, { pointerId: 4, clientY: 80 });
    expect(viewport.scrollTop).toBe(0);
  });

  it("updates the accessible position when the viewport scrolls", () => {
    const { scrollbar, viewport, track } = setup();
    expect(track.dataset.scrollable).toBe("true");
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    expect(scrollbar.getAttribute("aria-valuenow")).toBe("50");
  });

  it.each([
    ["Home", 0],
    ["End", 400],
    ["ArrowDown", 120],
    ["ArrowUp", 80],
    ["PageDown", 300],
    ["PageUp", 0],
  ])("supports %s keyboard navigation", (key, expected) => {
    const { scrollbar, viewport } = setup();
    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    act(() => scrollbar.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(viewport.scrollTop).toBe(expected);
  });

  it("ignores unrelated keyboard shortcuts", () => {
    const { scrollbar, viewport } = setup();
    viewport.scrollTop = 100;
    fireEvent.keyDown(scrollbar, { key: "Escape" });
    expect(viewport.scrollTop).toBe(100);
  });

  it("clicks the track to position the content and clamps the scroll range", () => {
    const { viewport, track } = setup();
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    fireEvent.pointerDown(track, { clientY: 110, pointerId: 1 });
    expect(viewport.scrollTop).toBe(400 * (100 / 180));
    fireEvent.pointerDown(track, { clientY: -100, pointerId: 2 });
    expect(viewport.scrollTop).toBe(0);
    fireEvent.pointerDown(track, { clientY: 400, pointerId: 3 });
    expect(viewport.scrollTop).toBe(400);
  });

  it("does not treat bubbled thumb presses as track clicks", () => {
    const { viewport, track, thumb } = setup();
    Object.defineProperty(thumb, "setPointerCapture", { configurable: true, value: vi.fn() });
    fireEvent.pointerDown(thumb, { pointerId: 2, clientY: 40 });
    expect(viewport.scrollTop).toBe(0);
    expect(track.dataset.scrollable).toBe("true");
  });

  it("drags the thumb through the available track travel and stops after release", () => {
    const { scrollbar, viewport, thumb } = setup();
    const capture = vi.fn();
    Object.defineProperty(thumb, "setPointerCapture", { configurable: true, value: capture });
    fireEvent.pointerDown(thumb, { pointerId: 7, clientY: 30 });
    expect(capture).toHaveBeenCalledWith(7);
    fireEvent.pointerMove(thumb, { pointerId: 7, clientY: 120 });
    expect(viewport.scrollTop).toBe(200);
    expect(scrollbar.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.pointerUp(thumb, { pointerId: 7 });
    fireEvent.pointerMove(thumb, { pointerId: 7, clientY: 200 });
    expect(viewport.scrollTop).toBe(200);
  });

  it("ignores mismatched drag pointers and supports pointer cancellation", () => {
    const { viewport, thumb } = setup();
    Object.defineProperty(thumb, "setPointerCapture", { configurable: true, value: vi.fn() });
    fireEvent.pointerDown(thumb, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(thumb, { pointerId: 2, clientY: 150 });
    expect(viewport.scrollTop).toBe(0);
    fireEvent.pointerCancel(thumb, { pointerId: 1 });
    fireEvent.pointerMove(thumb, { pointerId: 1, clientY: 150 });
    expect(viewport.scrollTop).toBe(0);
  });

  it("does not scroll for track clicks or drags without available travel", () => {
    const { viewport, track, thumb } = setup();
    setDimension(track, "clientHeight", 20);
    fireEvent.pointerDown(track, { pointerId: 1, clientY: 50 });
    fireEvent.pointerMove(thumb, { pointerId: 1, clientY: 100 });
    expect(viewport.scrollTop).toBe(0);
  });
});
