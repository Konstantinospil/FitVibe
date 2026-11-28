import { useEffect, useState } from "react";

const SECOND_MS = 1000;

/**
 * The current time in milliseconds, refreshed every second while `running`.
 * Timers derive their values from this and from stored timestamps, so they stay
 * right after a reload or when the tab was in the background.
 */
export function useClock(running: boolean, intervalMs = SECOND_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!running) {
      return undefined;
    }
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [running, intervalMs]);

  return now;
}
