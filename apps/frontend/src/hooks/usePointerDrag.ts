import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic pointer-driven drag and drop for mouse, touch and pen (Pointer Events).
 *
 * - Drop targets are any elements carrying `dropTargetAttribute`; its value is the
 *   target identifier handed to `onDrop`.
 * - A press that moves less than `activationDistance` stays a normal click, so the
 *   same handle can open a non-drag alternative (WCAG 2.5.7).
 * - The preview element follows the pointer through a ref and a CSS transform,
 *   so pointer moves do not re-render the page; React state only changes when the
 *   hovered target changes.
 * - Escape or a cancelled pointer aborts the drag without dropping.
 *
 * Handles should set `touch-action: none` so touch drags do not scroll the page;
 * the rest of the page keeps native scrolling.
 */

export interface PointerDragState<T> {
  item: T;
  overTarget: string | null;
}

export interface PointerDragOptions<T> {
  dropTargetAttribute: string;
  onDrop: (item: T, target: string) => void;
  activationDistance?: number;
}

interface PendingDrag<T> {
  item: T;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  overTarget: string | null;
  handle: HTMLElement;
}

// architecture-policy: implementation-constant -- pixels a press must travel before it becomes a drag instead of a click
const DEFAULT_ACTIVATION_DISTANCE = 6;

export function usePointerDrag<T>({
  dropTargetAttribute,
  onDrop,
  activationDistance = DEFAULT_ACTIVATION_DISTANCE,
}: PointerDragOptions<T>) {
  const [dragState, setDragState] = useState<PointerDragState<T> | null>(null);
  const pending = useRef<PendingDrag<T> | null>(null);
  const preview = useRef<HTMLElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const applyPreviewPosition = useCallback(() => {
    if (preview.current) {
      preview.current.style.transform = `translate3d(${pointer.current.x}px, ${pointer.current.y}px, 0)`;
    }
  }, []);

  const placePreview = useCallback(
    (x: number, y: number) => {
      pointer.current = { x, y };
      applyPreviewPosition();
    },
    [applyPreviewPosition],
  );

  /** Callback ref for the element that follows the pointer while dragging. */
  const previewRef = useCallback(
    (element: HTMLElement | null) => {
      preview.current = element;
      applyPreviewPosition();
    },
    [applyPreviewPosition],
  );

  const targetAt = useCallback(
    (x: number, y: number): string | null => {
      const hit =
        typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
      const target = hit?.closest(`[${dropTargetAttribute}]`);
      return target?.getAttribute(dropTargetAttribute) ?? null;
    },
    [dropTargetAttribute],
  );

  const end = useCallback(() => {
    const current = pending.current;
    if (current?.handle.hasPointerCapture?.(current.pointerId)) {
      current.handle.releasePointerCapture(current.pointerId);
    }
    pending.current = null;
    setDragState(null);
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        end();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dragState, end]);

  const getHandleProps = useCallback(
    (item: T) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0) {
          return;
        }
        suppressClick.current = false;
        pending.current = {
          item,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          overTarget: null,
          handle: event.currentTarget,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const current = pending.current;
        if (!current || current.pointerId !== event.pointerId) {
          return;
        }
        if (!current.active) {
          const distance = Math.hypot(
            event.clientX - current.startX,
            event.clientY - current.startY,
          );
          if (distance < activationDistance) {
            return;
          }
          current.active = true;
          setDragState({ item: current.item, overTarget: null });
        }
        event.preventDefault();
        placePreview(event.clientX, event.clientY);
        const overTarget = targetAt(event.clientX, event.clientY);
        if (overTarget !== current.overTarget) {
          current.overTarget = overTarget;
          setDragState({ item: current.item, overTarget });
        }
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        const current = pending.current;
        if (!current || current.pointerId !== event.pointerId) {
          return;
        }
        if (current.active) {
          suppressClick.current = true;
          const target = targetAt(event.clientX, event.clientY);
          end();
          if (target) {
            onDropRef.current(current.item, target);
          }
          return;
        }
        end();
      },
      onPointerCancel: () => end(),
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        // A completed drag must not also trigger the handle's click action.
        if (suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      },
    }),
    [activationDistance, end, placePreview, targetAt],
  );

  return { dragState, getHandleProps, previewRef };
}
