const dbMock = jest.fn();

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: Object.assign(dbMock, {
    fn: {
      now: jest.fn(() => "NOW"),
    },
  }),
}));

jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: {
    readOnlyMode: false,
  },
}));

describe("application settings runtime governance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function stateBuilder(state: { active_revision: number; maintenance_enabled: boolean }) {
    return {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(state),
      update: jest.fn().mockResolvedValue(1),
    };
  }

  it("starts fail-closed and exposes runtime state mutations", async () => {
    const runtime = await import(
      "../../../../apps/backend/src/modules/system/app-settings.runtime.js"
    );

    expect(runtime.getRuntimeGovernanceState()).toEqual(
      expect.objectContaining({
        authorityReady: false,
        maintenanceEnabled: false,
        activeRevision: 0,
        loadedRevision: 0,
        emergencyReadOnly: false,
      }),
    );
    expect(runtime.isEffectiveReadOnly()).toBe(true);

    runtime.setRuntimeMaintenance(true);
    expect(runtime.getRuntimeGovernanceState().maintenanceEnabled).toBe(true);

    runtime.setPersistedActiveRevision(3);
    expect(runtime.getRuntimeGovernanceState().activeRevision).toBe(3);
    expect(runtime.isEffectiveReadOnly()).toBe(true);
  });

  it("loads the persisted active revision and marks the authority ready", async () => {
    const settingsState = stateBuilder({ active_revision: 0, maintenance_enabled: false });

    dbMock.mockImplementation((table: string) => {
      if (table === "app_settings_state") {
        return settingsState;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const runtime = await import(
      "../../../../apps/backend/src/modules/system/app-settings.runtime.js"
    );

    await runtime.initializeApplicationSettingsRuntime();

    expect(settingsState.update).toHaveBeenCalledWith({
      loaded_revision: 0,
      updated_at: "NOW",
    });
    expect(runtime.getRuntimeGovernanceState()).toEqual(
      expect.objectContaining({
        authorityReady: true,
        maintenanceEnabled: false,
        activeRevision: 0,
        loadedRevision: 0,
        emergencyReadOnly: false,
      }),
    );
    expect(runtime.isEffectiveReadOnly()).toBe(false);
  });

  it("loads committed revision values and preserves persisted maintenance", async () => {
    const settingsState = stateBuilder({ active_revision: 2, maintenance_enabled: true });
    const revisionBuilder = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: "revision-2" }),
    };
    const itemsBuilder = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([
        {
          setting_key: "system.maintenance_message",
          new_value: "Controlled maintenance",
        },
      ]),
    };

    dbMock.mockImplementation((table: string) => {
      if (table === "app_settings_state") return settingsState;
      if (table === "app_setting_revisions") return revisionBuilder;
      if (table === "app_setting_revision_items") return itemsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const runtime = await import(
      "../../../../apps/backend/src/modules/system/app-settings.runtime.js"
    );

    await runtime.initializeApplicationSettingsRuntime();

    expect(runtime.getRuntimeGovernanceState()).toEqual(
      expect.objectContaining({
        authorityReady: true,
        maintenanceEnabled: true,
        activeRevision: 2,
        loadedRevision: 2,
        settings: expect.objectContaining({
          "system.maintenance_message": "Controlled maintenance",
        }),
      }),
    );
    expect(runtime.isEffectiveReadOnly()).toBe(true);
  });

  it("fails closed when the authority row is missing", async () => {
    const settingsState = stateBuilder({ active_revision: 0, maintenance_enabled: false });
    settingsState.first.mockResolvedValueOnce(undefined);

    dbMock.mockImplementation((table: string) => {
      if (table === "app_settings_state") return settingsState;
      throw new Error(`Unexpected table ${table}`);
    });

    const runtime = await import(
      "../../../../apps/backend/src/modules/system/app-settings.runtime.js"
    );

    await expect(runtime.initializeApplicationSettingsRuntime()).rejects.toThrow(
      "Application settings authority state is missing",
    );
    expect(runtime.isEffectiveReadOnly()).toBe(true);
  });
});
