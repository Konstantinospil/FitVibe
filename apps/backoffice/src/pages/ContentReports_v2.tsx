import React, { useState, useEffect } from "react";
import { useUiText } from "../i18n/ui";
import { AlertTriangle, EyeOff, Ban, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FreshTotpDialog } from "../components/FreshTotpDialog";
import {
  getFeedReports,
  moderateContent,
  type FeedReport,
  type ModerateContentRequest,
} from "../services/api";
import { useToast } from "../hooks/useToast";

const ContentReportsV2: React.FC = () => {
  const toast = useToast();
  const t = useUiText();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed" | "dismissed">(
    "pending",
  );
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingModeration, setPendingModeration] = useState<{
    reportId: string;
    action: "hide" | "ban";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getFeedReports({
          status: filterStatus === "all" ? undefined : filterStatus,
        });
        setReports(response.data);
      } catch {
        setError(t("reports.loadError"));
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [filterStatus, t]);

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

  const performModeration = async (
    reportId: string,
    action: "hide" | "dismiss" | "ban",
    totpCode?: string,
  ) => {
    try {
      const payload: ModerateContentRequest = { action, totpCode };
      await moderateContent(reportId, payload);
      toast.success(t(`reports.success.${action}`));
      const response = await getFeedReports({
        status: filterStatus === "all" ? undefined : filterStatus,
      });
      setReports(response.data);
      setPendingModeration(null);
    } catch (error) {
      toast.error(t("reports.actionError", { action: t(`reports.action.${action}`) }));
      if (totpCode) {
        throw error;
      }
    }
  };

  const handleModerateContent = (reportId: string, action: "hide" | "dismiss" | "ban") => {
    if (action !== "dismiss") {
      setPendingModeration({ reportId, action });
      return;
    }
    if (window.confirm(t("reports.dismissConfirm"))) {
      void performModeration(reportId, action);
    }
  };

  return (
    <div className="grid grid--gap-15">
      {pendingModeration ? (
        <FreshTotpDialog
          actionLabel={t("reports.challenge", { action: t(`reports.action.${pendingModeration.action}`) })}
          onCancel={() => setPendingModeration(null)}
          onConfirm={(code) =>
            performModeration(pendingModeration.reportId, pendingModeration.action, code)
          }
        />
      ) : null}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <AlertTriangle size={20} />
                <CardTitle>{t("reports.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("reports.description")}
              </CardDescription>
            </div>

            <div className="flex flex--gap-sm">
              {(["all", "pending", "reviewed", "dismissed"] as const).map((status) => (
                <Button
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
                    fontSize: "var(--type-supporting-size)",
                    fontWeight: "var(--font-weight-semibold)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t(`reports.status.${status}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="alert alert--error" style={{ marginBottom: "1rem" }}>
              {error}
            </div>
          )}
          {loading ? (
            <div className="empty-state text-secondary">{t("reports.loading")}</div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle
                size={48}
                className="icon icon--muted"
                style={{ margin: "0 auto 1rem" }}
              />
              <h3 className="text-125" style={{ marginBottom: "0.5rem" }}>
                {t("reports.emptyTitle")}
              </h3>
              <p className="text-secondary">
                {filterStatus === "all"
                  ? t("reports.emptyAll")
                  : t("reports.emptyStatus", { status: t(`reports.status.${filterStatus}`) })}
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
                          {t(`reports.status.${report.status}`)}
                        </span>
                        <span className="text-secondary text-09">
                          {t("reports.reporter", { username: report.reporterUsername })}
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: "var(--type-card-title-size)" }}>
                        {report.contentPreview || t("reports.reportedContent")}
                      </h4>
                      <p className="text-secondary" style={{ margin: "0.25rem 0 0" }}>
                        {report.reason}
                      </p>
                      {report.details ? (
                        <p className="text-secondary text-09" style={{ margin: "0.5rem 0 0" }}>
                          {report.details}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-secondary text-09">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="text-secondary text-09">
                      {report.contentAuthor
                        ? t("reports.author", { username: report.contentAuthor })
                        : t("reports.authorUnknown")}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "hide")}
                        leftIcon={<EyeOff size={16} />}
                      >
                        {t("reports.action.hide")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "dismiss")}
                        leftIcon={<X size={16} />}
                      >
                        {t("reports.action.dismiss")}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleModerateContent(report.id, "ban")}
                        leftIcon={<Ban size={16} />}
                      >
                        {t("reports.action.ban")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentReportsV2;
