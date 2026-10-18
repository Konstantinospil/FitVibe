import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import "./CustomScrollbar.css";

export interface CustomScrollbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  viewportClassName?: string;
  label?: string;
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({
  children,
  className = "",
  viewportClassName = "",
  label = "Scroll content",
  ...rest
}) => {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y: number; fraction: number } | null>(null);
  const id = useId();
  const [fraction, setFraction] = useState(0);
  const [overflow, setOverflow] = useState(false);

  const synchronize = useCallback(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    setOverflow(max > 1);
    setFraction(max ? el.scrollTop / max : 0);
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(synchronize);
    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }
    synchronize();
    return () => observer.disconnect();
  }, [synchronize, children]);

  const scrollTo = (next: number) => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    el.scrollTop = Math.max(0, Math.min(1, next)) * Math.max(0, el.scrollHeight - el.clientHeight);
    synchronize();
  };

  const travel = () =>
    Math.max(0, (track.current?.clientHeight ?? 0) - (thumb.current?.offsetHeight ?? 0));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!overflow) {
      return;
    }
    event.preventDefault();
    drag.current = { id: event.pointerId, y: event.clientY, fraction };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId || !travel()) {
      return;
    }
    scrollTo(drag.current.fraction + (event.clientY - drag.current.y) / travel());
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) {
      drag.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const delta: Record<string, number> = {
      ArrowDown: el.clientHeight / 10,
      ArrowUp: -el.clientHeight / 10,
      PageDown: el.clientHeight,
      PageUp: -el.clientHeight,
    };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      scrollTo(event.key === "Home" ? 0 : 1);
    } else if (event.key in delta) {
      event.preventDefault();
      el.scrollTop += delta[event.key];
      synchronize();
    }
  };

  return (
    <div {...rest} className={`custom-scrollbar ${className}`} data-scrollable={overflow}>
      <div
        id={id}
        ref={viewport}
        className={`custom-scrollbar__viewport ${viewportClassName}`}
        onScroll={synchronize}
        tabIndex={0}
      >
        <div className="custom-scrollbar__inner">{children}</div>
      </div>
      <div
        ref={track}
        className="custom-scrollbar__track"
        data-scrollable={overflow}
        role="scrollbar"
        aria-label={label}
        aria-controls={id}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        tabIndex={overflow ? 0 : -1}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget || !overflow || !travel()) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          scrollTo((event.clientY - rect.top - (thumb.current?.offsetHeight ?? 0) / 2) / travel());
        }}
      >
        <div
          ref={thumb}
          className="custom-scrollbar__thumb"
          style={{ top: `calc((100% - var(--scrollbar-thumb-size)) * ${fraction})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        />
      </div>
    </div>
  );
};
