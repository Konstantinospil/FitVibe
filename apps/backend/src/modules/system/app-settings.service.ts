import crypto from "node:crypto";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { assertActiveSudo, assertFreshPrivilegedTotp } from "../admin/superadmin.service.js";
import {
  APP_SETTINGS_REGISTRY,
  getDefaultSettings,
  validateAppSetting,
} from "./app-settings.registry.js";
import {
  getRuntimeGovernanceState,
  setPersistedActiveRevision,
  setRuntimeMaintenance,
} from "./app-settings.runtime.js";

async function getCommittedValues(): Promise<Record<string, unknown>> {
  const state = await db("app_settings_state").where({ id: 1 }).first<{ active_revision: string | number }>();
  const activeRevision = Number(state?.active_revision ?? 0);
  const values = getDefaultSettings();

  if (activeRevision === 0) {
    return values;
  }

  const revision = await db("app_setting_revisions")
    .where({ revision: activeRevision, status: "committed" })
    .first<{ id: string }>();

  if (!revision) {
    throw new HttpError(500, "APP_SETTINGS_STATE_INVALID", "Active settings revision is missing");
  }

  const rows = await db("app_setting_revision_items")
    .where({ revision_id: revision.id })
    .select<{ setting_key: string; new_value: unknown }[]>(["setting_key", "new_value"]);

  for (const row of rows) {
    values[row.setting_key] = row.new_value;
  }

  return values;
}

export async function getSettingsStatus() {
  const state = await db("app_settings_state").where({ id: 1 }).first();
  const runtime = getRuntimeGovernanceState();

  return {
    maintenanceEnabled: Boolean(state?.maintenance_enabled),
    activeRevision: Number(state?.active_revision ?? 0),
    loadedRevision: runtime.loadedRevision,
    revisionMatch: Number(state?.active_revision ?? 0) === runtime.loadedRevision,
    emergencyReadOnly: runtime.emergencyReadOnly,
    authorityReady: runtime.authorityReady,
    effectiveReadOnly:
      !runtime.authorityReady ||
      runtime.emergencyReadOnly ||
      Boolean(state?.maintenance_enabled) ||
      Number(state?.active_revision ?? 0) !== runtime.loadedRevision,
    registry: Object.values(APP_SETTINGS_REGISTRY).map(({ schema: _schema, ...definition }) => definition),
    values: await getCommittedValues(),
  };
}

export async function enableMaintenance(actorUserId: string, reason: string): Promise<void> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new HttpError(400, "MAINTENANCE_REASON_REQUIRED", "A non-blank maintenance reason is required");
  }

  await db("app_settings_state").where({ id: 1 }).update({
    maintenance_enabled: true,
    maintenance_reason: normalizedReason,
    maintenance_started_by: actorUserId,
    maintenance_started_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
  setRuntimeMaintenance(true);
}

export async function disableMaintenance(actorUserId: string): Promise<void> {
  const state = await db("app_settings_state").where({ id: 1 }).first<{
    active_revision: string | number;
    loaded_revision: string | number;
  }>();
  if (!state) {
    throw new HttpError(500, "APP_SETTINGS_STATE_INVALID", "Application settings state is missing");
  }

  const runtime = getRuntimeGovernanceState();
  if (runtime.emergencyReadOnly) {
    throw new HttpError(409, "EMERGENCY_READ_ONLY_ACTIVE", "Emergency read-only override is active");
  }
  if (Number(state.active_revision) !== runtime.loadedRevision) {
    throw new HttpError(
      409,
      "SETTINGS_REVISION_NOT_LOADED",
      "Maintenance cannot end until the committed settings revision is loaded by the runtime",
    );
  }

  await db("app_settings_state").where({ id: 1 }).update({
    maintenance_enabled: false,
    maintenance_reason: null,
    maintenance_started_by: null,
    maintenance_started_at: null,
    updated_at: db.fn.now(),
  });
  setRuntimeMaintenance(false);

  await db("audit_log").insert({
    id: crypto.randomUUID(),
    actor_user_id: actorUserId,
    entity_type: "application_settings",
    action: "maintenance_disabled",
    outcome: "success",
    metadata: { loadedRevision: runtime.loadedRevision },
    created_at: db.fn.now(),
  });
}

export async function stageSettingsRevision(input: {
  actorUserId: string;
  actorSessionJti: string;
  reason: string;
  changes: Record<string, unknown>;
}) {
  await assertActiveSudo(input.actorUserId, input.actorSessionJti);

  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, "SETTINGS_REASON_REQUIRED", "A non-blank change reason is required");
  }

  const state = await db("app_settings_state").where({ id: 1 }).first<{ maintenance_enabled: boolean }>();
  if (!state?.maintenance_enabled) {
    throw new HttpError(409, "MAINTENANCE_REQUIRED", "Settings changes require maintenance mode");
  }

  const current = await getCommittedValues();
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.changes)) {
    try {
      normalized[key] = validateAppSetting(key, value);
    } catch {
      throw new HttpError(400, "INVALID_APP_SETTING", `Invalid value for governed setting ${key}`);
    }
  }
  if (Object.keys(normalized).length === 0) {
    throw new HttpError(400, "SETTINGS_CHANGES_REQUIRED", "At least one settings change is required");
  }

  return db.transaction(async (trx) => {
    await trx("app_setting_revisions").where({ status: "staged" }).del();

    const maxRow = await trx("app_setting_revisions")
      .max<{ max: string | number | null }>("revision as max")
      .first();
    const revision = Number(maxRow?.max ?? 0) + 1;
    const id = crypto.randomUUID();

    await trx("app_setting_revisions").insert({
      id,
      revision,
      status: "staged",
      reason,
      created_by: input.actorUserId,
      created_at: trx.fn.now(),
    });

    for (const [key, newValue] of Object.entries(normalized)) {
      await trx("app_setting_revision_items").insert({
        revision_id: id,
        setting_key: key,
        old_value: current[key] ?? null,
        new_value: newValue,
      });
    }

    return {
      id,
      revision,
      reason,
      changes: Object.entries(normalized).map(([key, newValue]) => ({
        key,
        oldValue: current[key] ?? null,
        newValue,
      })),
    };
  });
}

export async function commitSettingsRevision(input: {
  actorUserId: string;
  actorSessionJti: string;
  revisionId: string;
  totpCode: string;
  requestId?: string | null;
}): Promise<{ revision: number }> {
  await assertActiveSudo(input.actorUserId, input.actorSessionJti);
  await assertFreshPrivilegedTotp(input.actorUserId, input.totpCode);

  return db.transaction(async (trx) => {
    const state = await trx("app_settings_state").where({ id: 1 }).first<{ maintenance_enabled: boolean }>();
    if (!state?.maintenance_enabled) {
      throw new HttpError(409, "MAINTENANCE_REQUIRED", "Settings changes require maintenance mode");
    }

    const revision = await trx("app_setting_revisions")
      .where({ id: input.revisionId, status: "staged", created_by: input.actorUserId })
      .first<{ id: string; revision: string | number; reason: string }>();
    if (!revision) {
      throw new HttpError(404, "SETTINGS_REVISION_NOT_FOUND", "Staged settings revision not found");
    }

    const changes = await trx("app_setting_revision_items")
      .where({ revision_id: revision.id })
      .select(["setting_key", "old_value", "new_value"]);

    await trx("app_setting_revisions").where({ id: revision.id }).update({
      status: "committed",
      committed_at: trx.fn.now(),
    });
    await trx("app_settings_state").where({ id: 1 }).update({
      active_revision: revision.revision,
      updated_at: trx.fn.now(),
    });

    await trx("audit_log").insert({
      id: crypto.randomUUID(),
      actor_user_id: input.actorUserId,
      entity_type: "application_settings",
      entity_id: revision.id,
      action: "settings_revision_committed",
      outcome: "success",
      request_id: input.requestId ?? null,
      metadata: {
        revision: Number(revision.revision),
        reason: revision.reason,
        changes,
        activation: "restart",
      },
      created_at: trx.fn.now(),
    });

    setPersistedActiveRevision(Number(revision.revision));
    return { revision: Number(revision.revision) };
  });
}
