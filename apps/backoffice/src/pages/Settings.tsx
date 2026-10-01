import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InputControl } from "@fitvibe/ui";
import {
  actionMappingsApi,
  disableClamav,
  disableMaintenanceMode,
  disableReadOnlyMode,
  enableClamav,
  enableMaintenanceMode,
  enableReadOnlyMode,
  getOpsStatus,
  getSystemConfig,
  type ActionUiMapping,
} from "../services/api";
import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../hooks/useThemeColors";
import { Button } from "../components/ui/Button";

const SettingsPage: React.FC = () => {
  const colors = useThemeColors();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [search, setSearch] = useState("");
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["action-mappings"],
    queryFn: () => actionMappingsApi.list(),
    enabled: isAuthenticated,
  });

  const { data: systemConfig, isLoading: isSystemConfigLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: getSystemConfig,
    enabled: isAuthenticated,
  });

  const { data: opsStatus, isLoading: isOpsStatusLoading } = useQuery({
    queryKey: ["admin-ops-status"],
    queryFn: getOpsStatus,
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: (mapping: { action: string; uiName: string }) => actionMappingsApi.upsert(mapping),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["action-mappings"] });
      setEditingAction(null);
      setEditValue("");
    },
  });

  const readOnlyMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) =>
      nextEnabled
        ? enableReadOnlyMode({ reason: "Activated from backoffice" })
        : disableReadOnlyMode({ notes: "Deactivated from backoffice" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["system-config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ops-status"] });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) =>
      nextEnabled
        ? enableMaintenanceMode({ message: "FitVibe is currently down for maintenance." })
        : disableMaintenanceMode(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["system-config"] });
    },
  });

  const clamavMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) => (nextEnabled ? enableClamav() : disableClamav()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ops-status"] });
    },
  });

  const isReadOnly = systemConfig?.readOnlyMode ?? false;
  const isMaintenance = systemConfig?.maintenanceMode ?? false;
  const clamavEnabled = opsStatus?.backend.clamavEnabled ?? false;
  const clamavHealth = opsStatus?.backend.clamavOk ?? false;

  const filteredMappings = useMemo(() => {
    const mappings = data?.mappings ?? [];
    if (!search.trim()) {
      return mappings;
    }
    const lowered = search.toLowerCase();
    return mappings.filter((mapping) => {
      const uiName = mapping.uiName ?? "";
      return (
        mapping.action.toLowerCase().includes(lowered) || uiName.toLowerCase().includes(lowered)
      );
    });
  }, [data, search]);

  const handleEdit = (mapping: ActionUiMapping) => {
    setEditingAction(mapping.action);
    setEditValue(mapping.uiName ?? "");
  };

  const handleSave = (action: string) => {
    if (!editValue.trim()) {
      return;
    }
    updateMutation.mutate({ action, uiName: editValue.trim() });
  };

  const handleCancel = () => {
    setEditingAction(null);
    setEditValue("");
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
        Settings
      </h1>

      <div style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            color: colors.text,
            marginBottom: "1rem",
            fontSize: "var(--type-section-title-size)",
          }}
        >
          System Controls
        </h2>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            padding: "1.5rem",
            background: colors.surface,
            borderRadius: "var(--radius-md)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ color: colors.text, fontWeight: "var(--font-weight-semibold)" }}>
                Read-only mode
              </div>
              <div style={{ color: colors.textSecondary, marginTop: "0.25rem" }}>
                Status: {isSystemConfigLoading ? "Loading..." : isReadOnly ? "Enabled" : "Disabled"}
              </div>
            </div>
            <Button
              variant={isReadOnly ? "danger" : "primary"}
              size="sm"
              isLoading={readOnlyMutation.isPending}
              disabled={isSystemConfigLoading || readOnlyMutation.isPending}
              onClick={() => readOnlyMutation.mutate(!isReadOnly)}
            >
              {isReadOnly ? "Disable Read-only" : "Enable Read-only"}
            </Button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ color: colors.text, fontWeight: "var(--font-weight-semibold)" }}>
                Maintenance mode
              </div>
              <div style={{ color: colors.textSecondary, marginTop: "0.25rem" }}>
                Status:{" "}
                {isSystemConfigLoading ? "Loading..." : isMaintenance ? "Enabled" : "Disabled"}
              </div>
            </div>
            <Button
              variant={isMaintenance ? "danger" : "primary"}
              size="sm"
              isLoading={maintenanceMutation.isPending}
              disabled={isSystemConfigLoading || maintenanceMutation.isPending}
              onClick={() => maintenanceMutation.mutate(!isMaintenance)}
            >
              {isMaintenance ? "Disable Maintenance" : "Enable Maintenance"}
            </Button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ color: colors.text, fontWeight: "var(--font-weight-semibold)" }}>
                ClamAV scanning
              </div>
              <div style={{ color: colors.textSecondary, marginTop: "0.25rem" }}>
                Status:{" "}
                {isOpsStatusLoading
                  ? "Loading..."
                  : clamavEnabled
                    ? `Enabled (${clamavHealth ? "OK" : "Down"})`
                    : "Disabled"}
              </div>
            </div>
            <Button
              variant={clamavEnabled ? "danger" : "primary"}
              size="sm"
              isLoading={clamavMutation.isPending}
              disabled={isOpsStatusLoading || clamavMutation.isPending}
              onClick={() => clamavMutation.mutate(!clamavEnabled)}
            >
              {clamavEnabled ? "Disable ClamAV" : "Enable ClamAV"}
            </Button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            color: colors.text,
            marginBottom: "1rem",
            fontSize: "var(--type-section-title-size)",
          }}
        >
          Action Labels
        </h2>
        <InputControl
          type="text"
          placeholder="Search actions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.75rem",
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: "var(--radius-sm)",
            color: colors.text,
            width: "100%",
            maxWidth: "420px",
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ color: colors.text }}>Loading...</div>
      ) : error ? (
        <div style={{ color: colors.error, padding: "2rem" }}>
          Error loading action mappings: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : filteredMappings.length === 0 ? (
        <div style={{ color: colors.text, textAlign: "center", padding: "2rem" }}>
          No action mappings found
        </div>
      ) : (
        <div
          style={{
            background: colors.surface,
            borderRadius: "var(--radius-sm)",
            overflowX: "auto",
            border: `1px solid ${colors.border}`,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
            <thead>
              <tr style={{ background: colors.surfaceMuted }}>
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
                  UI Name
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((mapping) => {
                const isEditing = editingAction === mapping.action;
                return (
                  <tr key={mapping.action} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "1rem", color: colors.text }}>{mapping.action}</td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <InputControl
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            style={{
                              padding: "0.5rem 0.75rem",
                              background: colors.surface,
                              border: `1px solid ${colors.border}`,
                              borderRadius: "var(--radius-sm)",
                              color: colors.text,
                              minWidth: "240px",
                            }}
                          />
                          <Button
                            onClick={() => handleSave(mapping.action)}
                            disabled={updateMutation.isPending}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--color-secondary)",
                              color: colors.text,
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancel}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "transparent",
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                          <span style={{ color: colors.textSecondary }}>
                            {mapping.uiName || "—"}
                          </span>
                          <Button
                            onClick={() => handleEdit(mapping)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              background: colors.border,
                              color: colors.text,
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
