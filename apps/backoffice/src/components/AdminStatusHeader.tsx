import React from "react";
import { useUiText } from "../i18n/ui";
import { useQuery } from "@tanstack/react-query";
import { getOpsStatus, type OpsLightStatus } from "../services/api";

const statusColors: Record<OpsLightStatus, string> = {
  green: "var(--color-success-text)",
  yellow: "var(--color-warning-text)",
  red: "var(--color-danger)",
};

const dotStyle = (status: OpsLightStatus): React.CSSProperties => ({
  width: "10px",
  height: "10px",
  borderRadius: "var(--radius-full)",
  background: statusColors[status],
});

const statusText = (ok: boolean, t: ReturnType<typeof useUiText>) =>
  ok ? t("common.ok") : t("common.down");

const AdminStatusHeader: React.FC = () => {
  const t = useUiText();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ops-status"],
    queryFn: getOpsStatus,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: "1rem 0", color: "var(--color-text-secondary)" }}>
        {t("status.loading")}
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="alert alert--warning" style={{ marginBottom: "1rem" }}>
        {t("status.error")}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        marginBottom: "1.5rem",
        padding: "1rem 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={dotStyle(data.backend.status)} />
            <span className="font-weight-600">{t("common.backend")}</span>
          </div>
          <div className="text-08 text-secondary">
            {t("common.db")} {statusText(data.backend.dbOk, t)} | {t("common.nginx")} {statusText(data.backend.nginxOk, t)} |
            {t("common.clamav")} {statusText(data.backend.clamavOk, t)} | {t("common.readOnly")}{" "}
            {data.backend.readOnly ? t("common.yes") : t("common.no")}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={dotStyle(data.frontend.status)} />
            <span className="font-weight-600">{t("common.frontend")}</span>
          </div>
          <div className="text-08 text-secondary">
            {t("common.status")} {data.frontend.ok ? t("common.running") : t("common.down")}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            { label: t("status.messages"), value: data.counts.unresolvedMessages },
            { label: t("status.violations"), value: data.counts.violationReports },
            { label: t("status.audit"), value: data.counts.unresolvedAuditLogs },
            { label: t("status.issues"), value: data.counts.openIssues },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                minWidth: "140px",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-glass)",
              }}
            >
              <div className="text-08 text-secondary">{item.label}</div>
              <div className="text-125 font-weight-600">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminStatusHeader;
