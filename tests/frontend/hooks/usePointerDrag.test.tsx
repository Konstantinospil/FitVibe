import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePointerDrag } from "../../src/hooks/usePointerDrag";

const ATTRIBUTE = "data-drop-zone";

const Harness: React.FC<{
  onDrop: (item: string, target: string) => void;
  onClick: () => void;
}> = ({ onDrop, onClick }) => {
  const { dragState, getHandleProps, previewRef } = usePointerDrag<string>({
    dropTargetAttribute: ATTRIBUTE,
    onDrop,
  });
  return (
    <div>
      <button type="button" {...getHandleProps("item-1")} onClick={onClick}>
        handle
      </button>
      <div data-testid="zone-a" {...{ [ATTRIBUTE]: "a" }}>
        <span data-testid="zone-a-child">inside a</span>
      </div>
      <div data-testid="outside">outside</div>
      <output data-testid="state">
        {dragState ? `${dragState.item}:${dragState.overTarget ?? "none"}` : "idle"}
      </output>
      {dragState ? <div data-testid="preview" ref={previewRef} /> : null}
    </div>
  );
};

describe("usePointerDrag", () => {
  let hit: Element | null;
  const originalElementFromPoint = document.elementFromPoint;

  beforeEach(() => {
    hit = null;
    document.elementFromPoint = vi.fn(() => hit);
  });

  afterEach(() => {
    document.elementFromPoint = originalElementFromPoint;
  });

  const setup = () => {
    const onDrop = vi.fn();
    const onClick = vi.fn();
    render(<Harness onDrop={onDrop} onClick={onClick} />);
    return { onDrop, onClick, handle: screen.getByRole("button", { name: "handle" }) };
  };

  const press = (handle: HTMLElement, pointerType = "mouse") =>
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });

  const moveTo = (handle: HTMLElement, x: number, y: number, pointerType = "mouse") =>
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      pointerType,
      isPrimary: true,
      clientX: x,
      clientY: y,
    });

  it("keeps a press without movement a normal click", () => {
    const { onDrop, onClick, handle } = setup();

    press(handle);
    moveTo(handle, 12, 11);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 12, clientY: 11 });
    fireEvent.click(handle);

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("tracks the hovered drop target, positions the preview and drops on release", () => {
    const { onDrop, onClick, handle } = setup();

    press(handle);
    moveTo(handle, 60, 40);
    expect(screen.getByTestId("state")).toHaveTextContent("item-1:none");
    expect(screen.getByTestId("preview").style.transform).toBe("translate3d(60px, 40px, 0px)");

    hit = screen.getByTestId("zone-a-child");
    moveTo(handle, 80, 90);
    expect(screen.getByTestId("state")).toHaveTextContent("item-1:a");
    expect(screen.getByTestId("preview").style.transform).toBe("translate3d(80px, 90px, 0px)");

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 80, clientY: 90 });
    fireEvent.click(handle);

    expect(onDrop).toHaveBeenCalledWith("item-1", "a");
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
  });

  it("supports touch pointers the same way", () => {
    const { onDrop, handle } = setup();

    press(handle, "touch");
    hit = screen.getByTestId("zone-a");
    moveTo(handle, 50, 50, "touch");
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientX: 50, clientY: 50 });

    expect(onDrop).toHaveBeenCalledWith("item-1", "a");
  });

  it("does not drop when released outside every target", () => {
    const { onDrop, handle } = setup();

    press(handle);
    hit = screen.getByTestId("zone-a");
    moveTo(handle, 50, 50);
    hit = screen.getByTestId("outside");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300, clientY: 300 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
  });

  it("cancels the drag on Escape and on pointer cancel", () => {
    const { onDrop, handle } = setup();

    press(handle);
    hit = screen.getByTestId("zone-a");
    moveTo(handle, 50, 50);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 50, clientY: 50 });

    press(handle);
    moveTo(handle, 50, 50);
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(screen.getByTestId("state")).toHaveTextContent("idle");

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("ignores secondary buttons", () => {
    const { handle } = setup();

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      isPrimary: true,
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    moveTo(handle, 80, 80);

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
  });
});
