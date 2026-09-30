import React, { useState, useEffect } from "react";
import { AlertTriangle, EyeOff, Ban, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  getFeedReports,
  moderateContent,
  type FeedReport,
  type ModerateContentRequest,
} from "../../services/api";
import { logger } from "../../utils/logger";
import { useToast } from "../../contexts/ToastContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";

const ContentReports: React.FC = () => {
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed" | "dismissed">(
    "pending",
  );
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showModerateConfirm, setShowModerateConfirm] = useState(false);
  const [pendingModeration, setPendingModeration] = useState<{
    reportId: string;
    action: "hide" | "dismiss" | "ban";
  } | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getFeedReports({
          status: filterStatus === "all" ? undefined : filterStatus,
        });
        setReports(response.data);
      } catch (err) {
        logger.apiError("Failed to load reports", err, "/api/v1/admin/reports", "GET");
        setError("Failed to load reports. Please try again.");
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "var(--color-warning)";
      case "reviewed":
        return "var(--color-accent)";
      case "dismissed":
        return "var(--color-text-muted)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  const handleModerateContent = (reportId: string, action: "hide" | "dismiss" | "ban") => {
    setPendingModeration({ reportId, action });
    setShowModerateConfirm(true);
  };

  const confirmModerateContent = async () => {
    if (!pendingModeration) {
      return;
    }

    const { reportId, action } = pendingModeration;
    setShowModerateConfirm(false);

    try {
      const payload: ModerateContentRequest = { action };
      await moderateContent(reportId, payload);

      toast.success(
        `Content ${action === "hide" ? "hidden" : action === "ban" ? "banned" : "dismissed"} successfully`,
      );

      // Refresh reports after successful moderation
      const response = await getFeedReports({
        status: filterStatus === "all" ? undefined : filterStatus,
      });
      setReports(response.data);

      setPendingModeration(null);
    } catch (err) {
      logger.apiError(
        `Failed to ${action} content`,
        err,
        `/api/v1/admin/reports/${reportId}/moderate`,
        "POST",
      );
      toast.error(`Failed to ${action} content. Please try again.`);
      setPendingModeration(null);
    }
  };

  return (
    <div className="grid grid--gap-15">
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <AlertTriangle size={20} />
                <CardTitle>Content Reports Queue</CardTitle>
              </div>
              <CardDescription>
                Review and moderate reported feed items and comments
              </CardDescription>
            </div>

            <div className="flex flex--gap-05">
              {(["all", "pending", "reviewed", "dismissed"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${filterStatus === status ? "var(--color-accent)" : "var(--color-border)"}`,
                    background:
                      filterStatus === status ? "var(--surface-success-subtle)" : "transparent",
                    color:
                      filterStatus === status
                        ? "var(--color-accent)"
                        : "var(--color-text-secondary)",
                    fontSize: "var(--type-body-size)",
                    fontWeight: "var(--font-weight-semibold)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
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
              {error}
            </div>
          )}
          {loading ? (
            <div className="empty-state text-secondary">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle
                size={48}
                className="icon icon--muted"
                style={{ margin: "0 auto 1rem" }}
              />
              <h3 className="text-125 mb-05">No reports to review</h3>
              <p className="text-secondary">
                {filterStatus === "all"
                  ? "There are currently no content reports."
                  : `No reports with status: ${filterStatus}`}
              </p>
            </div>
          ) : (
            <div className="grid grid--gap-md">
              {reports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--surface-muted-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "var(--type-supporting-size)",
                            fontWeight: "var(--font-weight-semibold)",
                            background: `${getStatusColor(report.status)}33`,
                            color: getStatusColor(report.status),
                          }}
                        >
                          {report.status}
                        </span>
                        <span className="text-09 text-secondary">
                          Reported by @{report.reporterUsername}
                        </span>
                      </div>

                      <div className="mb-075">
                        <strong className="text-105">Reason: {report.reason}</strong>
                        {report.details && (
                          <p
                            style={{
                              margin: "0.5rem 0 0",
                              color: "var(--color-text-secondary)",
                              fontSize: "var(--type-body-size)",
                            }}
                          >
                            {report.details}
                          </p>
                        )}
                      </div>

                      <div
                        style={{
                          padding: "1rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-muted-subtle)",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--color-text-secondary)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Content by @{report.contentAuthor}:
                        </div>
                        <div className="text-095" style={{ fontStyle: "italic" }}>
                          "{report.contentPreview}"
                        </div>
                      </div>

                      <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        Reported {new Date(report.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {report.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid var(--color-border)",
                      }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "dismiss")}
                        leftIcon={<X size={16} />}
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "hide")}
                        leftIcon={<EyeOff size={16} />}
                      >
                        Hide Content
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "ban")}
                        leftIcon={<Ban size={16} />}
                      >
                        Ban User
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showModerateConfirm}
        title={
          pendingModeration?.action === "ban"
            ? "Ban User"
            : pendingModeration?.action === "hide"
              ? "Hide Content"
              : "Dismiss Report"
        }
        message={
          pendingModeration?.action === "ban"
            ? "Are you sure you want to ban this user? This will ban the user and cannot be undone."
            : pendingModeration?.action === "hide"
              ? "Are you sure you want to hide this content? This action cannot be undone."
              : "Are you sure you want to dismiss this report?"
        }
        confirmLabel={
          pendingModeration?.action === "ban"
            ? "Yes, Ban User"
            : pendingModeration?.action === "hide"
              ? "Yes, Hide Content"
              : "Yes, Dismiss"
        }
        cancelLabel="Cancel"
        variant={pendingModeration?.action === "ban" ? "danger" : "warning"}
        onConfirm={() => void confirmModerateContent()}
        onCancel={() => {
          setShowModerateConfirm(false);
          setPendingModeration(null);
        }}
      />
    </div>
  );
};

export default ContentReports;
