import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { listAuthSessions, revokeAuthSessions, type SessionInfo } from "../services/api";
import { logger } from "../utils/logger";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Session Management Component
 *
 * Allows users to view and manage their active authentication sessions.
 * Users can:
 * - View all active sessions with device information
 * - Revoke individual sessions
 * - Revoke all other sessions (except current)
 * - Revoke all sessions
 */
export const SessionManagement: React.FC = () => {
  const { t } = useTranslation("common");
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);
  const [showRevokeOthersConfirm, setShowRevokeOthersConfirm] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAuthSessions();
      setSessions(response.sessions);
    } catch (error: unknown) {
      logger.apiError("Failed to load sessions", error, "/api/v1/auth/sessions", "GET");
      toast.error(t("auth.sessions.loadError") || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - loadSessions is stable enough with t/toast dependencies

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      setRevoking(sessionId);
      try {
        await revokeAuthSessions({ sessionId });
        toast.success(t("auth.sessions.revoked") || "Session revoked successfully");
        await loadSessions();
      } catch (error: unknown) {
        logger.apiError("Failed to revoke session", error, "/api/v1/auth/sessions/revoke", "POST");
        toast.error(t("auth.sessions.revokeError") || "Failed to revoke session");
      } finally {
        setRevoking(null);
      }
    },
    [t, toast, loadSessions],
  );

  const handleRevokeAll = useCallback(async () => {
    setShowRevokeAllConfirm(false);
    setRevoking("all");
    try {
      await revokeAuthSessions({ revokeAll: true });
      toast.success(t("auth.sessions.allRevoked") || "All sessions revoked successfully");
      // After revoking all, user will be logged out
      // Redirect will happen automatically via auth interceptor
      await loadSessions();
    } catch (error: unknown) {
      logger.apiError(
        "Failed to revoke all sessions",
        error,
        "/api/v1/auth/sessions/revoke",
        "POST",
      );
      toast.error(t("auth.sessions.revokeAllError") || "Failed to revoke all sessions");
    } finally {
      setRevoking(null);
    }
  }, [t, toast, loadSessions]);

  const handleRevokeOthers = useCallback(async () => {
    setShowRevokeOthersConfirm(false);
    setRevoking("others");
    try {
      await revokeAuthSessions({ revokeOthers: true });
      toast.success(t("auth.sessions.othersRevoked") || "Other sessions revoked successfully");
      await loadSessions();
    } catch (error: unknown) {
      logger.apiError(
        "Failed to revoke other sessions",
        error,
        "/api/v1/auth/sessions/revoke",
        "POST",
      );
      toast.error(t("auth.sessions.revokeOthersError") || "Failed to revoke other sessions");
    } finally {
      setRevoking(null);
    }
  }, [t, toast, loadSessions]);

  const getDeviceIcon = (userAgent: string | null): React.ReactNode => {
    if (!userAgent) {
      return <Globe size={16} />;
    }
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone size={16} />;
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return <Tablet size={16} />;
    }
    return <Monitor size={16} />;
  };

  const formatUserAgent = (userAgent: string | null): string => {
    if (!userAgent) {
      return t("auth.sessions.unknownDevice") || "Unknown device";
    }
    // Extract browser name
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome") && !ua.includes("edg")) {
      return "Chrome";
    }
    if (ua.includes("firefox")) {
      return "Firefox";
    }
    if (ua.includes("safari") && !ua.includes("chrome")) {
      return "Safari";
    }
    if (ua.includes("edg")) {
      return "Edge";
    }
    if (ua.includes("opera") || ua.includes("opr")) {
      return "Opera";
    }
    return userAgent.substring(0, 50);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      // SSR-safe: Use navigator.language only in browser, fallback to "en" on server
      const locale =
        typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const activeSessions = sessions.filter((s) => !s.revokedAt);
  const currentSession = activeSessions.find((s) => s.isCurrent);
  const otherSessions = activeSessions.filter((s) => !s.isCurrent);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.sessions.title") || "Active Sessions"}</CardTitle>
          <CardDescription>
            {t("auth.sessions.description") || "Manage your active authentication sessions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>{t("auth.sessions.loading") || "Loading sessions..."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.sessions.title") || "Active Sessions"}</CardTitle>
          <CardDescription>
            {t("auth.sessions.description") ||
              "Manage your active authentication sessions. Revoke sessions you no longer recognize."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <p>{t("auth.sessions.noSessions") || "No active sessions"}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {currentSession && (
                <div
                  style={{
                    padding: "1rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", flex: 1 }}>
                      {getDeviceIcon(currentSession.userAgent)}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong>{formatUserAgent(currentSession.userAgent)}</strong>
                          <span
                            style={{
                              fontSize: "var(--type-supporting-size)",
                              padding: "0.125rem 0.5rem",
                              backgroundColor: "#10b981",
                              color: "white",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {t("auth.sessions.current") || "Current"}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "var(--type-supporting-size)", color: "var(--color-text-muted)", marginTop: "0.25rem" }}
                        >
                          {currentSession.ip && (
                            <span>
                              {t("auth.sessions.ip") || "IP"}: {currentSession.ip}
                            </span>
                          )}
                          <span style={{ marginLeft: "0.5rem" }}>
                            {t("auth.sessions.created") || "Created"}:{" "}
                            {formatDate(currentSession.createdAt)}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "var(--type-supporting-size)", color: "var(--color-text-muted)", marginTop: "0.25rem" }}
                        >
                          {t("auth.sessions.expires") || "Expires"}:{" "}
                          {formatDate(currentSession.expiresAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {otherSessions.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <h3 style={{ fontSize: "var(--type-body-size)", fontWeight: "var(--font-weight-semibold)" }}>
                      {t("auth.sessions.otherSessions") || "Other Sessions"}
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRevokeOthersConfirm(true)}
                      disabled={revoking !== null}
                    >
                      {t("auth.sessions.revokeOthers") || "Revoke All Others"}
                    </Button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {otherSessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          padding: "1rem",
                          border: "1px solid #e5e7eb",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "flex", gap: "0.75rem", flex: 1 }}>
                          {getDeviceIcon(session.userAgent)}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "var(--font-weight-control-large)" }}>
                              {formatUserAgent(session.userAgent)}
                            </div>
                            <div
                              style={{
                                fontSize: "var(--type-supporting-size)",
                                color: "var(--color-text-muted)",
                                marginTop: "0.25rem",
                              }}
                            >
                              {session.ip && (
                                <span>
                                  {t("auth.sessions.ip") || "IP"}: {session.ip}
                                </span>
                              )}
                              <span style={{ marginLeft: "0.5rem" }}>
                                {t("auth.sessions.created") || "Created"}:{" "}
                                {formatDate(session.createdAt)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "var(--type-supporting-size)",
                                color: "var(--color-text-muted)",
                                marginTop: "0.25rem",
                              }}
                            >
                              {t("auth.sessions.expires") || "Expires"}:{" "}
                              {formatDate(session.expiresAt)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            void handleRevokeSession(session.id);
                          }}
                          disabled={revoking === session.id || revoking !== null}
                          aria-label={t("auth.sessions.revoke") || "Revoke session"}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}
              >
                <Button
                  variant="danger"
                  onClick={() => setShowRevokeAllConfirm(true)}
                  disabled={revoking !== null}
                >
                  {t("auth.sessions.revokeAll") || "Revoke All Sessions"}
                </Button>
                <p style={{ fontSize: "var(--type-supporting-size)", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                  {t("auth.sessions.revokeAllWarning") ||
                    "This will log you out from all devices. You will need to log in again."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showRevokeAllConfirm}
        onCancel={() => setShowRevokeAllConfirm(false)}
        onConfirm={() => {
          void handleRevokeAll();
        }}
        title={t("auth.sessions.confirmRevokeAll") || "Revoke All Sessions?"}
        message={
          t("auth.sessions.confirmRevokeAllMessage") ||
          "This will log you out from all devices. You will need to log in again. Are you sure?"
        }
        confirmLabel={t("auth.sessions.revokeAll") || "Revoke All"}
        cancelLabel={t("common.cancel") || "Cancel"}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showRevokeOthersConfirm}
        onCancel={() => setShowRevokeOthersConfirm(false)}
        onConfirm={() => {
          void handleRevokeOthers();
        }}
        title={t("auth.sessions.confirmRevokeOthers") || "Revoke Other Sessions?"}
        message={
          t("auth.sessions.confirmRevokeOthersMessage") ||
          "This will log you out from all other devices except this one. Are you sure?"
        }
        confirmLabel={t("auth.sessions.revokeOthers") || "Revoke Others"}
        cancelLabel={t("common.cancel") || "Cancel"}
        variant="danger"
      />
    </>
  );
};
