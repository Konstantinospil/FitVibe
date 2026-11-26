import type React from "react";
import { useCallback, useRef, useState } from "react";

/**
 * Keyboard "pick up and move", the keyboard counterpart of `usePointerDrag`
 * (WCAG 2.1.1 / 2.5.7):
 *
 * - Space picks the item up on its handle.
 * - Arrow keys move the target through `step`.
 * - Enter or Space drops the item on the current target.
 * - Escape, or focus leaving the handle, cancels.
 *
 * While nothing is picked up, Enter keeps the handle's normal click action, so
 * the same control can still open a dialog. State has the same shape as
 * `usePointerDrag`, so a page can render both with one code path.
 */

export interface KeyboardMoveState<T> {
  item: T;
  overTarget: string;
}

export type KeyboardMoveEvent = "pickup" | "move" | "drop" | "cancel";

export interface KeyboardMoveOptions<T> {
  /** Target the item starts on when picked up. */
  initialTarget: (item: T) => string;
  /** Next target for an arrow key; return the same key at a boundary. */
  step: (target: string, key: string) => string | null;
  onDrop: (item: T, target: string) => void;
  /** Lets the page announce pick-up, moves, drops and cancellation. */
  onEvent?: (event: KeyboardMoveEvent, item: T, target: string) => void;
}

export function useKeyboardMove<T>({
  initialTarget,
  step,
  onDrop,
  onEvent,
}: KeyboardMoveOptions<T>) {
  const [moveState, setMoveState] = useState<KeyboardMoveState<T> | null>(null);
  // Mirrors the state synchronously so key handlers never act on a stale render.
  const current = useRef<KeyboardMoveState<T> | null>(null);

  const update = useCallback((next: KeyboardMoveState<T> | null) => {
    current.current = next;
    setMoveState(next);
  }, []);

  const cancel = useCallback(() => {
    const active = current.current;
    if (active) {
      update(null);
      onEvent?.("cancel", active.item, active.overTarget);
    }
  }, [onEvent, update]);

  const getKeyHandlers = useCallback(
    (item: T) => ({
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        const active = current.current;
        if (!active) {
          if (event.key === " ") {
            event.preventDefault();
            const target = initialTarget(item);
            update({ item, overTarget: target });
            onEvent?.("pickup", item, target);
          }
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          // Enter would otherwise also fire the handle's click action.
          event.preventDefault();
          update(null);
          onEvent?.("drop", active.item, active.overTarget);
          onDrop(active.item, active.overTarget);
          return;
        }
        const next = step(active.overTarget, event.key);
        if (next !== null) {
          event.preventDefault();
          if (next !== active.overTarget) {
            update({ item: active.item, overTarget: next });
            onEvent?.("move", active.item, next);
          }
        }
      },
      onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => {
        // A button activates on Space key-up; picking up or dropping must not click it.
        if (event.key === " ") {
          event.preventDefault();
        }
      },
      onBlur: cancel,
    }),
    [cancel, initialTarget, onDrop, onEvent, step, update],
  );

  return { moveState, getKeyHandlers, cancel };
}
