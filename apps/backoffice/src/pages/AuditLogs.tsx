import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  auditLogsApi,
  actionMappingsApi,
  type AuditLogEntry,
  type AuditLogSeverity,
} from "../services/api";
import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../hooks/useThemeColors";
import { Button } from "../components/ui/Button";
import { InputControl, SelectControl } from "@fitvibe/ui";

const severityOptions: AuditLogSeverity[] = ["info", "warning", "error", "critical"];

const severityColors: Record<AuditLogSeverity, string> = {
  info: "var(--color-info-text)",
  warning: "var(--color-warning-text)",
  error: "var(--color-danger)",
  critical: "var(--vibe-explosivity)",
};

function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function formatAction(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const actionLabelMap: Record<string, string> = {
  "auth.login": "User login",
  "auth.refresh": "Session refresh",
  profile_update: "Profile updated",
};

const entityLabelMap: Record<string, string> = {
  auth: "Authentication",
  users: "Users",
};

const fieldLabelMap: Record<string, string> = {
  display_name: "Display name",
  fitness_level: "Fitness level",
  training_frequency: "Training frequency",
  weight: "Weight",
  alias: "Alias",
};

const metadataLabelMap: Record<string, string> = {
  ip: "IP Address",
  requestId: "Request ID",
  sessionId: "Session ID",
  userAgent: "User agent",
  previousTokenId: "Previous token ID",
};

function formatMetadataValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[Unserializable]";
  }
}

function formatLabel(value: string, map: Record<string, string>): string {
  return map[value] ?? formatAction(value);
}

function getChangeList(metadata: Record<string, unknown> | null): Array<{
  field: string;
  oldValue: unknown;
  nextValue: unknown;
}> {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const changes = metadata.changes;
  if (!changes || typeof changes !== "object") {
    return [];
  }
  return Object.entries(changes as Record<string, unknown>)
    .map(([field, value]) => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const record = value as { old?: unknown; next?: unknown };
      return {
        field,
        oldValue: record.old,
        nextValue: record.next,
      };
    })
    .filter((item): item is { field: string; oldValue: unknown; nextValue: unknown } => !!item);
}

function buildSummary(log: AuditLogEntry, getActionLabel: (action: string) => string): string {
  if (log.action === "profile_update") {
    const changes = getChangeList(log.metadata);
    if (changes.length) {
      const fields = changes.map((change) => formatLabel(change.field, fieldLabelMap)).join(", ");
      return `Profile updated: ${fields}`;
    }
    return "Profile updated";
  }
  if (log.action === "auth.login") {
    return "User signed in";
  }
  if (log.action === "auth.refresh") {
    return "Session refreshed";
  }
  return getActionLabel(log.action);
}

const AuditLogsPage: React.FC = () => {
  const colors = useThemeColors();
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<AuditLogSeverity | "all">("all");
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "resolved" | "unresolved">("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [requestIdFilter, setRequestIdFilter] = useState("");
  const [requestIdInput, setRequestIdInput] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const limit = 50;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const createdFromIso = useMemo(() => toIsoDate(createdFrom), [createdFrom]);
  const createdToIso = useMemo(() => toIsoDate(createdTo), [createdTo]);
  const normalizedActionFilter = useMemo(() => [...actionFilter].sort(), [actionFilter]);

  const resolvedValue =
    resolvedFilter === "resolved" ? true : resolvedFilter === "unresolved" ? false : undefined;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setRequestIdFilter(requestIdInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [requestIdInput]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "audit-logs",
      page,
      severityFilter,
      resolvedFilter,
      createdFromIso,
      createdToIso,
      normalizedActionFilter,
      requestIdFilter,
    ],
    queryFn: () =>
      auditLogsApi.list({
        limit,
        offset: page * limit,
        action: normalizedActionFilter.length > 0 ? normalizedActionFilter : undefined,
        severity: severityFilter === "all" ? undefined : severityFilter,
        resolved: resolvedValue,
        createdFrom: createdFromIso,
        createdTo: createdToIso,
        requestId: requestIdFilter.trim() || undefined,
      }),
    enabled: isAuthenticated,
  });

  const { data: actionMappingsData } = useQuery({
    queryKey: ["action-mappings"],
    queryFn: () => actionMappingsApi.list(),
    enabled: isAuthenticated,
  });

  const actionUiNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const mapping of actionMappingsData?.mappings ?? []) {
      if (mapping.uiName) {
        map[mapping.action] = mapping.uiName;
      }
    }
    return map;
  }, [actionMappingsData]);

  const getActionLabel = (action: string) =>
    actionUiNameMap[action] ?? actionLabelMap[action] ?? formatAction(action);

  const actionOptions = useMemo(() => {
    const actionSet = new Set<string>();
    for (const mapping of actionMappingsData?.mappings ?? []) {
      actionSet.add(mapping.action);
    }
    for (const action of Object.keys(actionLabelMap)) {
      actionSet.add(action);
    }
    for (const log of data?.logs ?? []) {
      actionSet.add(log.action);
    }
    const actions = Array.from(actionSet);
    actions.sort((left, right) => {
      const leftLabel = actionUiNameMap[left] ?? actionLabelMap[left] ?? formatAction(left);
      const rightLabel = actionUiNameMap[right] ?? actionLabelMap[right] ?? formatAction(right);
      return leftLabel.localeCompare(rightLabel);
    });
    return actions.map((action) => ({
      value: action,
      label: actionUiNameMap[action] ?? actionLabelMap[action] ?? formatAction(action),
    }));
  }, [actionMappingsData, actionUiNameMap, data?.logs]);

  const queryClient = useQueryClient();

  const updateLogMutation = useMutation({
    mutationFn: ({
      logId,
      updates,
    }: {
      logId: string;
      updates: { severity?: AuditLogSeverity; resolved?: boolean };
    }) => auditLogsApi.update(logId, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const bulkUpdateResolvedMutation = useMutation({
    mutationFn: async ({ logIds, resolved }: { logIds: string[]; resolved: boolean }) => {
      if (logIds.length === 0) {
        return 0;
      }
      return auditLogsApi.bulkUpdateResolved(logIds, resolved);
    },
    onSuccess: () => {
      setSelectedLogIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const handleUpdateSeverity = (logId: string, severity: AuditLogSeverity) => {
    updateLogMutation.mutate({ logId, updates: { severity } });
  };

  const handleToggleResolved = (log: AuditLogEntry) => {
    updateLogMutation.mutate({ logId: log.id, updates: { resolved: !log.resolvedAt } });
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  const handleToggleAction = (action: string) => {
    setActionFilter((current) =>
      current.includes(action) ? current.filter((item) => item !== action) : [...current, action],
    );
    setPage(0);
  };

  useEffect(() => {
    setSelectedLogIds(new Set());
  }, [
    page,
    severityFilter,
    resolvedFilter,
    createdFromIso,
    createdToIso,
    normalizedActionFilter,
    requestIdFilter,
  ]);

  const currentLogIds = useMemo(() => data?.logs?.map((log) => log.id) ?? [], [data?.logs]);
  const allSelected =
    currentLogIds.length > 0 && currentLogIds.every((logId) => selectedLogIds.has(logId));
  const selectedLogs = useMemo(
    () => data?.logs?.filter((log) => selectedLogIds.has(log.id)) ?? [],
    [data?.logs, selectedLogIds],
  );
  const resolvableLogIds = selectedLogs.filter((log) => !log.resolvedAt).map((log) => log.id);
  const reopenableLogIds = selectedLogs.filter((log) => log.resolvedAt).map((log) => log.id);

  const handleToggleSelectLog = (logId: string) => {
    setSelectedLogIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedLogIds((_current) => {
      if (allSelected) {
        return new Set();
      }
      return new Set(currentLogIds);
    });
  };

  const handleResolveSelected = () => {
    bulkUpdateResolvedMutation.mutate({ logIds: resolvableLogIds, resolved: true });
  };

  const handleReopenSelected = () => {
    bulkUpdateResolvedMutation.mutate({ logIds: reopenableLogIds, resolved: false });
  };

  return (
    <div>
      <h1
        style={{
          color: colors.text,
          marginBottom: "2rem",
          fontSize: "var(--type-page-title-size)",
        }}
      >
        Audit Logs
      </h1>

      <div style={{ marginBottom: "1.5rem", maxWidth: "360px" }}>
        <label
          style={{ color: colors.text, display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          Search by Request ID
          <InputControl
            type="search"
            value={requestIdInput}
            onChange={(e) => {
              setRequestIdInput(e.target.value);
            }}
            placeholder="Request ID"
          />
        </label>
      </div>

      <div style={{ marginBottom: "2rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <label
          style={{ color: colors.text, display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          Severity
          <SelectControl
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as AuditLogSeverity | "all");
              setPage(0);
            }}
          >
            <option value="all">All</option>
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </SelectControl>
        </label>

        <label
          style={{ color: colors.text, display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          Resolved
          <SelectControl
            value={resolvedFilter}
            onChange={(e) => {
              setResolvedFilter(e.target.value as "all" | "resolved" | "unresolved");
              setPage(0);
            }}
          >
            <option value="all">All</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </SelectControl>
        </label>

        <div
          style={{
            color: colors.text,
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            minWidth: "220px",
          }}
        >
          <span>Action</span>
          <details style={{ position: "relative" }}>
            <summary
              style={{
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              {actionFilter.length > 0 ? `${actionFilter.length} selected` : "All"}
            </summary>
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 0.35rem)",
                left: 0,
                zIndex: 10,
                minWidth: "260px",
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: "var(--radius-sm)",
                padding: "0.75rem",
                boxShadow: "var(--shadow-popover)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                  Select actions
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActionFilter([]);
                    setPage(0);
                  }}
                  style={{ color: colors.textMuted, padding: 0, boxShadow: "none" }}
                >
                  Clear
                </Button>
              </div>
              {actionOptions.length === 0 ? (
                <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                  No actions available
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    maxHeight: "240px",
                    overflowY: "auto",
                  }}
                >
                  {actionOptions.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        color: colors.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={actionFilter.includes(option.value)}
                        onChange={() => handleToggleAction(option.value)}
                      />
                      <span style={{ fontSize: "var(--type-supporting-size)" }}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>

        <label
          style={{ color: colors.text, display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          From
          <InputControl
            type="datetime-local"
            value={createdFrom}
            onChange={(e) => {
              setCreatedFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>

        <label
          style={{ color: colors.text, display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          To
          <InputControl
            type="datetime-local"
            value={createdTo}
            onChange={(e) => {
              setCreatedTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>

      {isLoading ? (
        <div style={{ color: colors.text }}>Loading...</div>
      ) : error ? (
        <div style={{ color: colors.text, padding: "2rem" }}>
          Error loading audit logs: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : !data || !data.logs || data.logs.length === 0 ? (
        <div style={{ color: colors.text, textAlign: "center", padding: "2rem" }}>
          No audit logs found
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
              {selectedLogIds.size > 0
                ? `${selectedLogIds.size} selected`
                : "Select logs to resolve in bulk"}
            </span>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleResolveSelected}
                disabled={resolvableLogIds.length === 0 || bulkUpdateResolvedMutation.isPending}
              >
                Mark Selected Resolved
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReopenSelected}
                disabled={reopenableLogIds.length === 0 || bulkUpdateResolvedMutation.isPending}
                style={{ background: colors.surfaceMuted, color: colors.text }}
              >
                Reopen Selected
              </Button>
            </div>
          </div>
          <div
            style={{
              background: colors.surface,
              borderRadius: "var(--radius-sm)",
              overflowX: "auto",
              overflowY: "visible",
              border: `1px solid ${colors.border}`,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
              <thead>
                <tr style={{ background: colors.surfaceMuted }}>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                      width: "48px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleSelectAll}
                      disabled={currentLogIds.length === 0}
                      aria-label="Select all logs on this page"
                    />
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Action
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Entity
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Actor
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Severity
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Outcome
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Summary
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Resolved
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedLogIds.has(log.id)}
                        onChange={() => handleToggleSelectLog(log.id)}
                        disabled={bulkUpdateResolvedMutation.isPending}
                        aria-label={`Select log ${log.id}`}
                      />
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {getActionLabel(log.action)}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {formatLabel(log.entityType, entityLabelMap)}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {log.actorDisplayName || log.actorUsername || log.actorUserId || "-"}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <SelectControl
                        controlSize="sm"
                        value={log.severity}
                        onChange={(e) =>
                          handleUpdateSeverity(log.id, e.target.value as AuditLogSeverity)
                        }
                        disabled={
                          updateLogMutation.isPending || bulkUpdateResolvedMutation.isPending
                        }
                        style={{
                          color: severityColors[log.severity],
                          fontWeight: "var(--font-weight-semibold)",
                          textTransform: "uppercase",
                          fontSize: "var(--type-supporting-size)",
                        }}
                      >
                        {severityOptions.map((severity) => (
                          <option key={severity} value={severity}>
                            {severity}
                          </option>
                        ))}
                      </SelectControl>
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {formatAction(log.outcome)}
                    </td>
                    <td style={{ padding: "1rem", color: colors.textSecondary }}>
                      {buildSummary(log, getActionLabel)}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {log.resolvedAt ? (
                        <span style={{ color: colors.success }}>Resolved</span>
                      ) : (
                        <span style={{ color: colors.warning }}>Open</span>
                      )}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          style={{
                            background: colors.border,
                            color: colors.text,
                            whiteSpace: "nowrap",
                          }}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          variant={log.resolvedAt ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => handleToggleResolved(log)}
                          disabled={
                            updateLogMutation.isPending || bulkUpdateResolvedMutation.isPending
                          }
                          style={{ color: colors.text, whiteSpace: "nowrap" }}
                        >
                          {log.resolvedAt ? "Reopen" : "Mark Resolved"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.logs.length >= limit && (
            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span style={{ color: colors.text }}>Page {page + 1}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.logs.length < limit}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {selectedLog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--modal-backdrop)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: colors.surface,
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${colors.border}`,
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.5rem",
              }}
            >
              <h2
                style={{
                  color: colors.text,
                  fontSize: "var(--type-section-title-size)",
                  margin: 0,
                }}
              >
                Audit Log Details
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close audit log details"
                onClick={handleCloseModal}
                style={{
                  color: colors.text,
                  fontSize: "var(--type-section-title-size)",
                  padding: "0.25rem 0.5rem",
                }}
              >
                ×
              </Button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Created
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {new Date(selectedLog.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Action
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {getActionLabel(selectedLog.action)}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Entity
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {formatLabel(selectedLog.entityType, entityLabelMap)}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Actor
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {selectedLog.actorUsername || selectedLog.actorUserId || "-"}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Severity
              </div>
              <div
                style={{
                  color: severityColors[selectedLog.severity],
                  fontSize: "var(--type-body-size)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                {selectedLog.severity.toUpperCase()}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Outcome
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {formatAction(selectedLog.outcome)}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: colors.textMuted, fontSize: "var(--type-supporting-size)" }}>
                Resolved
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {selectedLog.resolvedAt
                  ? new Date(selectedLog.resolvedAt).toLocaleString()
                  : "Open"}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.5rem",
                }}
              >
                Summary
              </div>
              <div style={{ color: colors.text, fontSize: "var(--type-body-size)" }}>
                {buildSummary(selectedLog, getActionLabel)}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.5rem",
                }}
              >
                Metadata
              </div>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                <div
                  style={{
                    background: colors.surfaceMuted,
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${colors.border}`,
                    maxHeight: "300px",
                    overflow: "auto",
                  }}
                >
                  {getChangeList(selectedLog.metadata).length > 0 && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ color: colors.textMuted, marginBottom: "0.5rem" }}>Changes</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th
                              style={{ textAlign: "left", padding: "0.5rem", color: colors.text }}
                            >
                              Field
                            </th>
                            <th
                              style={{ textAlign: "left", padding: "0.5rem", color: colors.text }}
                            >
                              From
                            </th>
                            <th
                              style={{ textAlign: "left", padding: "0.5rem", color: colors.text }}
                            >
                              To
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {getChangeList(selectedLog.metadata).map((change) => (
                            <tr
                              key={change.field}
                              style={{ borderBottom: `1px solid ${colors.border}` }}
                            >
                              <td
                                style={{
                                  padding: "0.5rem",
                                  color: colors.text,
                                  fontWeight: "var(--font-weight-semibold)",
                                }}
                              >
                                {formatLabel(change.field, fieldLabelMap)}
                              </td>
                              <td style={{ padding: "0.5rem", color: colors.text }}>
                                {formatMetadataValue(change.oldValue)}
                              </td>
                              <td style={{ padding: "0.5rem", color: colors.text }}>
                                {formatMetadataValue(change.nextValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {Object.entries(selectedLog.metadata).filter(([key]) => key !== "changes")
                    .length > 0 && (
                    <div>
                      <div style={{ color: colors.textMuted, marginBottom: "0.5rem" }}>Context</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {Object.entries(selectedLog.metadata)
                            .filter(([key]) => key !== "changes")
                            .map(([key, value]) => (
                              <tr key={key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                    color: colors.text,
                                    fontWeight: "var(--font-weight-semibold)",
                                    width: "35%",
                                  }}
                                >
                                  {formatLabel(key, metadataLabelMap)}
                                </td>
                                <td style={{ padding: "0.5rem", color: colors.text }}>
                                  {formatMetadataValue(value)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: colors.textMuted }}>No metadata available.</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseModal}
                style={{ color: colors.text, border: `1px solid ${colors.border}` }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
