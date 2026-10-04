import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Power, PowerOff, Activity, Clock, AlertCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  getSystemReadOnlyStatus,
  enableReadOnlyMode,
  disableReadOnlyMode,
  getHealthStatus,
  type SystemReadOnlyStatus,
  type HealthStatusResponse,
} from "../../services/api";
import { getRecentActivity, type AuditLogEntry } from "../../services/adminApi";
import { logger } from "../../utils/logger";
import { useToast } from "../../contexts/ToastContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";

const SystemControls: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [readOnlyStatus, setReadOnlyStatus] = useState<SystemReadOnlyStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatusResponse | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Read-only mode controls
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [enableReason, setEnableReason] = useState("");
  const [enableDuration, setEnableDuration] = useState("");
  const [disableNotes, setDisableNotes] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    void loadSystemStatus();
    void loadRecentActivity();
    // Poll every 30 seconds
    const interval = setInterval(() => {
      void loadSystemStatus();
      void loadRecentActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      const [readOnly, health] = await Promise.all([getSystemReadOnlyStatus(), getHealthStatus()]);
      setReadOnlyStatus(readOnly);
      setHealthStatus(health);
    } catch (error) {
      logger.apiError("Failed to load system status", error, "/api/v1/admin/system/status", "GET");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    setActivityLoading(true);
    try {
      const activity = await getRecentActivity(10);
      setRecentActivity(activity);
    } catch (error) {
      logger.apiError(
        "Failed to load recent activity",
        error,
        "/api/v1/logs/recent-activity",
        "GET",
      );
    } finally {
      setActivityLoading(false);
    }
  };

  const handleEnableReadOnly = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      await enableReadOnlyMode({
        reason: enableReason || undefined,
        estimatedDuration: enableDuration || undefined,
      });

      await loadSystemStatus();
      setShowEnableConfirm(false);
      setEnableReason("");
      setEnableDuration("");
      toast.success("Read-only mode enabled successfully");
    } catch (error) {
      logger.apiError(
        "Failed to enable read-only mode",
        error,
        "/api/v1/admin/system/readonly",
        "POST",
      );
      setActionError("Failed to enable read-only mode. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableReadOnly = () => {
    setShowDisableConfirm(true);
  };

  const confirmDisableReadOnly = async () => {
    setShowDisableConfirm(false);
    setActionLoading(true);
    setActionError(null);

    try {
      await disableReadOnlyMode({
        notes: disableNotes || undefined,
      });

      await loadSystemStatus();
      setDisableNotes("");
      toast.success("Read-only mode disabled successfully");
    } catch (error) {
      logger.apiError(
        "Failed to disable read-only mode",
        error,
        "/api/v1/admin/system/readonly",
        "DELETE",
      );
      setActionError("Failed to disable read-only mode. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatActivityTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatAction = (action: string, _entityType: string): string => {
    // Format action strings like "auth.login" -> "Login"
    const parts = action.split(".");
    const actionName = parts[parts.length - 1];
    return actionName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div
            style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}
          >
            Loading system status...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid--gap-15">
      {/* System Health */}
      <Card>
        <CardHeader>
          <div className="flex flex--align-center flex--gap-075">
            <Activity size={20} className="icon--accent" />
            <CardTitle>System Health</CardTitle>
          </div>
          <CardDescription>Real-time system status and uptime</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.5rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Status
              </div>
              <div className="flex flex--align-center flex--gap-05">
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "var(--radius-full)",
                    background:
                      healthStatus?.status === "ok" ? "var(--color-accent)" : "var(--color-danger)",
                  }}
                />
                <span className="text-125 font-weight-600">
                  {healthStatus?.status === "ok" ? "Healthy" : "Degraded"}
                </span>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Uptime
              </div>
              <div className="text-125 font-weight-600">
                {healthStatus?.uptime ? formatUptime(healthStatus.uptime) : "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Mode
              </div>
              <div
                style={{
                  fontSize: "var(--type-card-title-size)",
                  fontWeight: "var(--font-weight-semibold)",
                  color: readOnlyStatus?.readOnlyMode ? "orange" : "var(--color-accent)",
                }}
              >
                {readOnlyStatus?.readOnlyMode ? "Read-Only" : "Normal"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Mode Control */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {readOnlyStatus?.readOnlyMode ? (
              <PowerOff size={20} style={{ color: "orange" }} />
            ) : (
              <Power size={20} style={{ color: "var(--color-accent)" }} />
            )}
            <CardTitle>Read-Only Mode</CardTitle>
          </div>
          <CardDescription>
            Emergency maintenance mode - blocks all write operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionError && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-danger-subtle)",
                border: "1px solid var(--border-danger-subtle)",
                color: "var(--color-danger)",
              }}
            >
              {actionError}
            </div>
          )}

          {!readOnlyStatus?.readOnlyMode && !showEnableConfirm && (
            <div>
              <p className="mb-1 text-secondary">
                System is currently operating normally. Enable read-only mode to block all write
                operations for emergency maintenance.
              </p>
              <Button
                variant="secondary"
                onClick={() => setShowEnableConfirm(true)}
                leftIcon={<PowerOff size={18} />}
              >
                Enable Read-Only Mode
              </Button>
            </div>
          )}

          {!readOnlyStatus?.readOnlyMode && showEnableConfirm && (
            <div>
              <div
                style={{
                  padding: "1rem",
                  marginBottom: "1rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-warning-subtle)",
                  border: "1px solid var(--border-warning-subtle)",
                  color: "var(--color-warning)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <AlertCircle size={18} />
                  <strong>Warning</strong>
                </div>
                Enabling read-only mode will block all user write operations. Use this only for
                emergency maintenance.
              </div>

              <div className="grid grid--gap-md mb-1">
                <div>
                  <label
                    htmlFor="enable-reason"
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "var(--type-body-size)",
                      fontWeight: "var(--font-weight-semibold)",
                    }}
                  >
                    Reason (optional)
                  </label>
                  <input
                    id="enable-reason"
                    type="text"
                    value={enableReason}
                    onChange={(e) => setEnableReason(e.target.value)}
                    placeholder={t("admin.systemControls.maintenanceMessagePlaceholder")}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--type-body-size)",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="enable-duration"
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "var(--type-body-size)",
                      fontWeight: "var(--font-weight-semibold)",
                    }}
                  >
                    Estimated Duration (optional)
                  </label>
                  <input
                    id="enable-duration"
                    type="text"
                    value={enableDuration}
                    onChange={(e) => setEnableDuration(e.target.value)}
                    placeholder={t("admin.systemControls.durationPlaceholder")}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--type-body-size)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEnableConfirm(false);
                    setEnableReason("");
                    setEnableDuration("");
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleEnableReadOnly()}
                  isLoading={actionLoading}
                  leftIcon={<PowerOff size={18} />}
                >
                  {actionLoading ? "Enabling..." : "Confirm Enable"}
                </Button>
              </div>
            </div>
          )}

          {readOnlyStatus?.readOnlyMode && (
            <div>
              <div
                style={{
                  padding: "1rem",
                  marginBottom: "1rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-warning-subtle)",
                  border: "1px solid var(--border-warning-subtle)",
                  color: "var(--color-warning)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <PowerOff size={18} />
                  <strong>Read-Only Mode Active</strong>
                </div>
                <p style={{ margin: 0 }}>
                  {readOnlyStatus.message ||
                    "System is in maintenance mode. All write operations are blocked."}
                </p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="disable-notes"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "var(--type-body-size)",
                    fontWeight: "var(--font-weight-semibold)",
                  }}
                >
                  Notes (optional)
                </label>
                <input
                  id="disable-notes"
                  type="text"
                  value={disableNotes}
                  onChange={(e) => setDisableNotes(e.target.value)}
                  placeholder={t("admin.systemControls.completionMessagePlaceholder")}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--type-body-size)",
                  }}
                />
              </div>

              <Button
                variant="primary"
                onClick={() => void handleDisableReadOnly()}
                isLoading={actionLoading}
                leftIcon={<Power size={18} />}
              >
                {actionLoading ? "Disabling..." : "Disable Read-Only Mode"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Clock size={20} />
            <CardTitle>Recent Admin Activity</CardTitle>
          </div>
          <CardDescription>Last 10 administrative actions</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}
            >
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}
            >
              No recent activity
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "0.875rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-card)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--type-body-size)",
                            fontWeight: "var(--font-weight-semibold)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {formatAction(entry.action, entry.entityType)}
                        </span>
                        {entry.outcome && (
                          <span
                            style={{
                              fontSize: "var(--type-supporting-size)",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "var(--radius-sm)",
                              background:
                                entry.outcome === "success"
                                  ? "var(--surface-success-subtle)"
                                  : entry.outcome === "failure"
                                    ? "var(--surface-danger-subtle)"
                                    : "var(--border-subtle)",
                              color:
                                entry.outcome === "success"
                                  ? "var(--color-success)"
                                  : entry.outcome === "failure"
                                    ? "var(--color-danger)"
                                    : "var(--color-text-secondary)",
                            }}
                          >
                            {entry.outcome}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--color-text-secondary)",
                          marginTop: "0.25rem",
                        }}
                      >
                        {entry.actorUsername || entry.actorUserId || "System"}
                        {entry.entityType && ` • ${entry.entityType}`}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--type-supporting-size)",
                        color: "var(--color-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatActivityTime(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDisableConfirm}
        title="Disable Read-Only Mode"
        message="Are you sure you want to disable read-only mode and restore normal operations?"
        confirmLabel="Yes, Disable"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => void confirmDisableReadOnly()}
        onCancel={() => setShowDisableConfirm(false)}
      />
    </div>
  );
};

export default SystemControls;
