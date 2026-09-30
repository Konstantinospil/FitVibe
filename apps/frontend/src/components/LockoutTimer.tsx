import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export interface LockoutTimerProps {
  remainingSeconds: number;
  lockoutType: "account" | "ip";
  onExpired?: () => void;
}

/**
 * LockoutTimer component displays a countdown timer for lockout periods
 * Updates every second and automatically stops when lockout expires
 */
export const LockoutTimer: React.FC<LockoutTimerProps> = ({
  remainingSeconds: initialRemainingSeconds,
  lockoutType,
  onExpired,
}) => {
  const { t } = useTranslation();
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);

  useEffect(() => {
    // Update remaining seconds from prop if it changes
    setRemainingSeconds(initialRemainingSeconds);
  }, [initialRemainingSeconds]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onExpired?.();
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onExpired?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, onExpired]);

  if (remainingSeconds <= 0) {
    return null;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const lockoutTypeLabel =
    lockoutType === "account"
      ? t("auth.lockout.accountLockout", { defaultValue: "Account lockout" })
      : t("auth.lockout.ipLockout", { defaultValue: "IP lockout" });

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1rem",
        background: "var(--surface-danger-subtle)",
        border: "1px solid var(--border-danger-subtle)",
        borderRadius: "12px",
        color: "var(--color-text-primary)",
      }}
    >
      <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>
        {t("auth.lockout.lockoutActive", {
          defaultValue: "{{type}} active",
          type: lockoutTypeLabel,
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          fontSize: "1.1rem",
          fontFamily: "monospace",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            padding: "0.5rem 0.75rem",
            background: "var(--surface-danger-subtle)",
            borderRadius: "8px",
            minWidth: "4rem",
            textAlign: "center",
          }}
        >
          {formattedTime}
        </span>
        <span style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
          {t("auth.lockout.remaining", {
            defaultValue: "remaining",
          })}
        </span>
      </div>
      <div
        style={{
          fontSize: "0.85rem",
          color: "var(--color-text-secondary)",
        }}
        aria-label={t("auth.lockout.timerAriaLabel", {
          defaultValue: "Time remaining: {{time}}",
          time: formattedTime,
        })}
      >
        {t("auth.lockout.retryAfter", {
          defaultValue: "You can try again after the timer expires",
        })}
      </div>
    </div>
  );
};
