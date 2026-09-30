import React from "react";
import { useTranslation } from "react-i18next";

export interface AttemptCounterProps {
  remainingAccountAttempts: number;
  remainingIPAttempts: number;
  remainingIPDistinctEmails: number;
  accountAttemptCount: number;
  ipTotalAttemptCount: number;
  ipDistinctEmailCount: number;
}

/**
 * AttemptCounter component displays remaining attempts before lockout
 * Shows warnings when approaching lockout threshold
 */
export const AttemptCounter: React.FC<AttemptCounterProps> = ({
  remainingAccountAttempts,
  remainingIPAttempts,
  remainingIPDistinctEmails,
  accountAttemptCount,
  ipTotalAttemptCount,
  ipDistinctEmailCount,
}) => {
  const { t } = useTranslation();

  // Find the minimum remaining attempts (most restrictive)
  const minRemaining = Math.min(
    remainingAccountAttempts,
    remainingIPAttempts,
    remainingIPDistinctEmails,
  );

  // Determine which lockout will trigger first
  let lockoutType: "account" | "ip" | "ip-email" = "account";
  if (minRemaining === remainingIPAttempts) {
    lockoutType = "ip";
  } else if (minRemaining === remainingIPDistinctEmails) {
    lockoutType = "ip-email";
  }

  // Determine warning level
  const isWarning = minRemaining <= 3 && minRemaining > 0;
  const isCritical = minRemaining === 1;

  if (minRemaining <= 0) {
    // Should not happen if component is shown, but handle gracefully
    return null;
  }

  const getWarningColor = () => {
    if (isCritical) {
      return {
        background: "var(--surface-danger-subtle)",
        border: "1px solid var(--border-danger-subtle)",
        color: "var(--color-text-primary)",
      };
    }
    if (isWarning) {
      return {
        background: "var(--surface-warning-subtle)",
        border: "1px solid var(--border-warning-subtle)",
        color: "var(--color-text-primary)",
      };
    }
    return {
      background: "var(--surface-focus-subtle)",
      border: "1px solid var(--border-focus-subtle)",
      color: "var(--color-text-primary)",
    };
  };

  const getLockoutTypeMessage = () => {
    if (lockoutType === "account") {
      return t("auth.lockout.accountLockoutWarning", {
        defaultValue: "Account lockout",
      });
    }
    if (lockoutType === "ip-email") {
      return t("auth.lockout.ipEmailLockoutWarning", {
        defaultValue: "IP lockout (too many different emails)",
      });
    }
    return t("auth.lockout.ipLockoutWarning", {
      defaultValue: "IP lockout",
    });
  };

  return (
    <div
      role="alert"
      style={{
        ...getWarningColor(),
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--type-body-size)",
      }}
    >
      <div style={{ fontWeight: "var(--font-weight-control-large)", marginBottom: "0.25rem" }}>
        {isCritical
          ? t("auth.lockout.criticalWarning", {
              defaultValue: "⚠️ Last attempt before lockout",
            })
          : isWarning
            ? t("auth.lockout.warning", {
                defaultValue: "⚠️ Approaching lockout",
              })
            : t("auth.lockout.info", {
                defaultValue: "ℹ️ Lockout protection active",
              })}
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        {t("auth.lockout.remainingAttempts", {
          defaultValue: "{{count}} attempt{{plural}} remaining before {{type}}",
          count: minRemaining,
          plural: minRemaining === 1 ? "" : "s",
          type: getLockoutTypeMessage(),
        })}
      </div>
      {(accountAttemptCount > 0 || ipTotalAttemptCount > 0) && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "var(--type-supporting-size)",
            color: "var(--color-text-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {accountAttemptCount > 0 && (
            <span>
              {t("auth.lockout.accountAttempts", {
                defaultValue: "Account attempts: {{count}}",
                count: accountAttemptCount,
              })}
            </span>
          )}
          {ipTotalAttemptCount > 0 && (
            <span>
              {t("auth.lockout.ipAttempts", {
                defaultValue: "IP attempts: {{count}} ({{emails}} different emails)",
                count: ipTotalAttemptCount,
                emails: ipDistinctEmailCount,
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
