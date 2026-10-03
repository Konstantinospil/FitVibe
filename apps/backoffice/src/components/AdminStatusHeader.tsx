import React from "react";
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

const statusText = (ok: boolean) => (ok ? "OK" : "Down");

const AdminStatusHeader: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ops-status"],
    queryFn: getOpsStatus,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: "1rem 0", color: "var(--color-text-secondary)" }}>
        Loading system status...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="alert alert--warning" style={{ marginBottom: "1rem" }}>
        Unable to load system status.
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
            <span className="font-weight-600">Backend</span>
          </div>
          <div className="text-08 text-secondary">
            DB: {statusText(data.backend.dbOk)} | NGINX: {statusText(data.backend.nginxOk)} |
            ClamAV: {statusText(data.backend.clamavOk)} | Read-only:{" "}
            {data.backend.readOnly ? "Yes" : "No"}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={dotStyle(data.frontend.status)} />
            <span className="font-weight-600">Frontend (5173)</span>
          </div>
          <div className="text-08 text-secondary">
            Status: {data.frontend.ok ? "Running" : "Down"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            { label: "Unresolved messages", value: data.counts.unresolvedMessages },
            { label: "Violation reports", value: data.counts.violationReports },
            { label: "Unresolved audit logs", value: data.counts.unresolvedAuditLogs },
            { label: "Open issues", value: data.counts.openIssues },
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
