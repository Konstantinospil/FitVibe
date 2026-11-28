import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardMove, type KeyboardMoveEvent } from "../../src/hooks/useKeyboardMove";

const TARGETS = ["a", "b", "c"];

const step = (target: string, key: string) => {
  if (key !== "ArrowLeft" && key !== "ArrowRight") {
    return null;
  }
  const next = TARGETS.indexOf(target) + (key === "ArrowRight" ? 1 : -1);
  return TARGETS[next] ?? target;
};

const Harness: React.FC<{
  onDrop: (item: string, target: string) => void;
  onEvent: (event: KeyboardMoveEvent, item: string, target: string) => void;
  onClick: () => void;
}> = ({ onDrop, onEvent, onClick }) => {
  const { moveState, getKeyHandlers } = useKeyboardMove<string>({
    initialTarget: () => "a",
    step,
    onDrop,
    onEvent,
  });
  return (
    <div>
      <button type="button" {...getKeyHandlers("item-1")} onClick={onClick}>
        handle
      </button>
      <button type="button">elsewhere</button>
      <output data-testid="state">
        {moveState ? `${moveState.item}:${moveState.overTarget}` : "idle"}
      </output>
    </div>
  );
};

const setup = () => {
  const onDrop = vi.fn();
  const onEvent = vi.fn();
  const onClick = vi.fn();
  render(<Harness onDrop={onDrop} onEvent={onEvent} onClick={onClick} />);
  const handle = screen.getByRole("button", { name: "handle" });
  handle.focus();
  return { onDrop, onEvent, onClick, handle, state: () => screen.getByTestId("state") };
};

describe("useKeyboardMove", () => {
  it("picks up with Space, steps with arrows and drops with Enter", () => {
    const { onDrop, onEvent, onClick, handle, state } = setup();

    fireEvent.keyDown(handle, { key: " " });
    expect(state()).toHaveTextContent("item-1:a");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(state()).toHaveTextContent("item-1:c");
    fireEvent.keyDown(handle, { key: "Enter" });

    expect(onDrop).toHaveBeenCalledWith("item-1", "c");
    expect(onEvent.mock.calls.map(([event, , target]) => `${event}:${target}`)).toEqual([
      "pickup:a",
      "move:b",
      "move:c",
      "drop:c",
    ]);
    expect(state()).toHaveTextContent("idle");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("drops with Space as well", () => {
    const { onDrop, handle } = setup();

    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: " " });

    expect(onDrop).toHaveBeenCalledWith("item-1", "b");
  });

  it("prevents the Space key-up click so picking up does not activate the handle", () => {
    const { handle } = setup();

    const keyUp = new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true });
    fireEvent.keyDown(handle, { key: " " });
    handle.dispatchEvent(keyUp);

    expect(keyUp.defaultPrevented).toBe(true);
  });

  it("announces no move at a boundary", () => {
    const { onEvent, handle, state } = setup();

    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });

    expect(state()).toHaveTextContent("item-1:a");
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual(["pickup"]);
  });

  it("cancels on Escape and when focus leaves the handle", () => {
    const { onDrop, onEvent, handle, state } = setup();

    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "Escape" });
    expect(state()).toHaveTextContent("idle");

    fireEvent.keyDown(handle, { key: " " });
    fireEvent.blur(handle);
    expect(state()).toHaveTextContent("idle");

    expect(onDrop).not.toHaveBeenCalled();
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      "pickup",
      "cancel",
      "pickup",
      "cancel",
    ]);
  });

  it("leaves Enter and other keys alone while nothing is picked up", () => {
    const { onEvent, handle, state } = setup();

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    handle.dispatchEvent(enter);
    fireEvent.keyDown(handle, { key: "ArrowRight" });

    expect(enter.defaultPrevented).toBe(false);
    expect(state()).toHaveTextContent("idle");
    expect(onEvent).not.toHaveBeenCalled();
  });
});
