import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/Tabs";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { Pagination } from "../ui/Pagination";
import { ContentModerationActions } from "./ContentModerationActions";
import { getFeedReports, type FeedReport } from "../../services/api";
import { EmptyState } from "../utils/EmptyState";
import { Inbox } from "lucide-react";

export interface ModerationQueueProps {
  onReportActioned?: () => void;
}

/**
 * ModerationQueue component displays a queue of reported content for moderation.
 * Supports filtering by status and pagination.
 */
export const ModerationQueue: React.FC<ModerationQueueProps> = ({ onReportActioned }) => {
  const { t } = useTranslation("common");
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [status, setStatus] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);
      try {
        const response = await getFeedReports({
          status: status === "all" ? undefined : status,
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
        });
        setReports(response.data);
        setTotalPages(Math.ceil(response.total / itemsPerPage));
      } catch {
        // Error handling would be done by parent component
      } finally {
        setIsLoading(false);
      }
    };

    void loadReports();
  }, [status, currentPage]);

  const handleActionComplete = () => {
    onReportActioned?.();
    // Reload reports
    const loadReports = async () => {
      const response = await getFeedReports({
        status: status === "all" ? undefined : status,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      });
      setReports(response.data);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
    };
    void loadReports();
  };

  const getStatusBadge = (reportStatus: string) => {
    const variants: Record<string, "info" | "success" | "warning" | "danger"> = {
      pending: "warning",
      reviewed: "success",
      dismissed: "info",
    };
    return (
      <Badge variant={variants[reportStatus] || "info"} size="sm">
        {t(`admin.moderation.status.${reportStatus}`)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.moderation.queue.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue={status}
          value={status}
          onValueChange={(val) => setStatus(val as typeof status)}
        >
          <TabsList>
            <TabsTrigger value="pending">{t("admin.moderation.status.pending")}</TabsTrigger>
            <TabsTrigger value="reviewed">{t("admin.moderation.status.reviewed")}</TabsTrigger>
            <TabsTrigger value="dismissed">{t("admin.moderation.status.dismissed")}</TabsTrigger>
            <TabsTrigger value="all">{t("admin.moderation.status.all")}</TabsTrigger>
          </TabsList>
          <TabsContent value={status}>
            {isLoading ? (
              <div
                style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}
              >
                <Spinner size="md" />
              </div>
            ) : reports.length === 0 ? (
              <EmptyState title={t("admin.moderation.queue.empty")} icon={<Inbox size={48} />} />
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                  {reports.map((report) => (
                    <Card key={report.id}>
                      <CardContent>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-md)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "var(--space-sm)",
                                  alignItems: "center",
                                  marginBottom: "var(--space-xs)",
                                }}
                              >
                                <strong>{t("admin.moderation.reportedBy")}:</strong>
                                <span>{report.reporterUsername}</span>
                                {getStatusBadge(report.status)}
                              </div>
                              <div
                                style={{
                                  fontSize: "var(--font-size-sm)",
                                  color: "var(--color-text-secondary)",
                                  marginBottom: "var(--space-xs)",
                                }}
                              >
                                <strong>{t("admin.moderation.reason")}:</strong> {report.reason}
                              </div>
                              {report.details && (
                                <div
                                  style={{
                                    fontSize: "var(--font-size-sm)",
                                    color: "var(--color-text-secondary)",
                                    marginBottom: "var(--space-xs)",
                                  }}
                                >
                                  <strong>{t("admin.moderation.details")}:</strong> {report.details}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: "var(--font-size-sm)",
                                  color: "var(--color-text-secondary)",
                                  marginBottom: "var(--space-xs)",
                                }}
                              >
                                <strong>{t("admin.moderation.content")}:</strong>{" "}
                                {report.contentPreview}
                              </div>
                              <div
                                style={{
                                  fontSize: "var(--font-size-xs)",
                                  color: "var(--color-text-muted)",
                                }}
                              >
                                {new Date(report.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {report.status === "pending" && (
                            <ContentModerationActions
                              reportId={report.id}
                              onActionComplete={handleActionComplete}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div
                    style={{
                      marginTop: "var(--space-lg)",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
