import {
  APP_SETTINGS_REGISTRY,
  getDefaultSettings,
  validateAppSetting,
} from "../../../../apps/backend/src/modules/system/app-settings.registry.js";

describe("governed application settings registry", () => {
  it("returns canonical defaults for every registered setting", () => {
    const defaults = getDefaultSettings();

    expect(defaults).toEqual({
      "auth.email_verification_ttl_minutes": 15,
      "auth.password_reset_ttl_minutes": 15,
      "privacy.dsr_purge_delay_minutes": 15,
      "privacy.dsr_backup_purge_days": 14,
      "system.maintenance_message": "System is temporarily in read-only mode for maintenance",
      "moderation.feed_blocked_keywords": [],
    });
    expect(Object.keys(defaults)).toHaveLength(Object.keys(APP_SETTINGS_REGISTRY).length);
  });

  it("validates and normalizes registered values", () => {
    expect(validateAppSetting("auth.email_verification_ttl_minutes", 30)).toBe(30);
    expect(validateAppSetting("system.maintenance_message", "  Planned maintenance  ")).toBe(
      "Planned maintenance",
    );
    expect(validateAppSetting("moderation.feed_blocked_keywords", ["Spam", "scam"])).toEqual([
      "Spam",
      "scam",
    ]);
  });

  it("rejects unknown settings and invalid values", () => {
    expect(() => validateAppSetting("unknown.setting", true)).toThrow(
      "Unknown governed application setting",
    );
    expect(() => validateAppSetting("auth.password_reset_ttl_minutes", 1)).toThrow();
    expect(() => validateAppSetting("system.maintenance_message", "   ")).toThrow();
  });
});
