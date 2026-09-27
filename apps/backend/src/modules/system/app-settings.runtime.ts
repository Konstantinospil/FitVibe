import { db } from "../../db/connection.js";
import { env } from "../../config/env.js";
import { getDefaultSettings } from "./app-settings.registry.js";

export interface RuntimeGovernanceState {
  authorityReady: boolean;
  maintenanceEnabled: boolean;
  activeRevision: number;
  loadedRevision: number;
  emergencyReadOnly: boolean;
  settings: Record<string, unknown>;
}

let runtimeState: RuntimeGovernanceState = {
  authorityReady: false,
  maintenanceEnabled: false,
  activeRevision: 0,
  loadedRevision: 0,
  emergencyReadOnly: env.readOnlyMode,
  settings: getDefaultSettings(),
};

export function getRuntimeGovernanceState(): RuntimeGovernanceState {
  return runtimeState;
}

export function isEffectiveReadOnly(): boolean {
  return (
    !runtimeState.authorityReady ||
    runtimeState.emergencyReadOnly ||
    runtimeState.maintenanceEnabled ||
    runtimeState.activeRevision !== runtimeState.loadedRevision
  );
}

export async function initializeApplicationSettingsRuntime(): Promise<void> {
  const state = await db("app_settings_state").where({ id: 1 }).first<{
    active_revision: string | number;
    maintenance_enabled: boolean;
  }>();

  if (!state) {
    throw new Error("Application settings authority state is missing");
  }

  const activeRevision = Number(state.active_revision);
  const settings = getDefaultSettings();

  if (activeRevision > 0) {
    const revision = await db("app_setting_revisions")
      .where({ revision: activeRevision, status: "committed" })
      .first<{ id: string }>();

    if (!revision) {
      throw new Error(`Committed application settings revision ${activeRevision} not found`);
    }

    const items = await db("app_setting_revision_items")
      .where({ revision_id: revision.id })
      .select<{ setting_key: string; new_value: unknown }[]>(["setting_key", "new_value"]);

    for (const item of items) {
      settings[item.setting_key] = item.new_value;
    }
  }

  await db("app_settings_state").where({ id: 1 }).update({
    loaded_revision: activeRevision,
    updated_at: db.fn.now(),
  });

  runtimeState = {
    authorityReady: true,
    maintenanceEnabled: Boolean(state.maintenance_enabled),
    activeRevision,
    loadedRevision: activeRevision,
    emergencyReadOnly: env.readOnlyMode,
    settings,
  };
}

export function setRuntimeMaintenance(enabled: boolean): void {
  runtimeState = { ...runtimeState, maintenanceEnabled: enabled };
}

export function setPersistedActiveRevision(revision: number): void {
  runtimeState = { ...runtimeState, activeRevision: revision };
}
